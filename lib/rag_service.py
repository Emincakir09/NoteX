import os
import shutil
import json
import io
import zipfile
from langchain_community.vectorstores import FAISS
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_core.documents import Document


class RAGService:
    def __init__(self, persistence_path="./faiss_index", bucket=None):
        """
        RAG Servisi - HuggingFace Embeddings + Firebase Storage Yedekleme
        """
        self.persistence_path = persistence_path
        self.registry_path = os.path.join(persistence_path, "registry.json")
        self.vector_store = None
        self.document_registry = {}
        self.bucket = bucket

        # Firebase Storage'daki zip yolu (kullanıcıya özel)
        path_key = os.path.basename(persistence_path)
        self.firebase_storage_path = f"faiss_indexes/{path_key}.zip"

        # 1. HuggingFace Embedding Modeli Başlat (Hızlı Yerel İşlem)
        try:
            self.embedding_fn = HuggingFaceEmbeddings(
                model_name="all-MiniLM-L6-v2"
            )
        except Exception as e:
            print(f"Model yükleme hatası: {e}")
            self.embedding_fn = None

        # 2. Lokal dizin yoksa Firebase'den indir
        if not os.path.exists(self.persistence_path) and self.bucket:
            self._download_from_firebase()

        # 3. Varsa lokal indeksi yükle
        if os.path.exists(self.persistence_path):
            try:
                self.vector_store = FAISS.load_local(
                    self.persistence_path,
                    self.embedding_fn,
                    allow_dangerous_deserialization=True
                )
                if os.path.exists(self.registry_path):
                    with open(self.registry_path, "r", encoding="utf-8") as f:
                        self.document_registry = json.load(f)
            except Exception as e:
                print(f"FAISS index yükleme hatası (sıfırlanıyor): {e}")
                self._reset_local_index()

        print(
            f"DEBUG: RAGService başlatıldı. "
            f"Path: {self.persistence_path}, "
            f"Belgeler: {list(self.document_registry.keys())}"
        )

    # ------------------------------------------------------------------
    # Firebase Storage Yedekleme / Geri Yükleme
    # ------------------------------------------------------------------

    def _upload_to_firebase(self):
        """FAISS index klasörünü zip'leyip Firebase Storage'a yükler."""
        if not self.bucket or not os.path.exists(self.persistence_path):
            return
        try:
            zip_buffer = io.BytesIO()
            with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zf:
                for root, dirs, files in os.walk(self.persistence_path):
                    for file in files:
                        file_path = os.path.join(root, file)
                        arcname = os.path.relpath(file_path, self.persistence_path)
                        zf.write(file_path, arcname)
            zip_buffer.seek(0)
            blob = self.bucket.blob(self.firebase_storage_path)
            blob.upload_from_file(zip_buffer, content_type="application/zip")
            print(f"✅ FAISS index Firebase'e yüklendi: {self.firebase_storage_path}")
        except Exception as e:
            print(f"⚠️ Firebase'e yükleme hatası: {e}")

    def _download_from_firebase(self):
        """Firebase Storage'dan FAISS index'i indirip yerel diske çıkarır."""
        if not self.bucket:
            return
        try:
            blob = self.bucket.blob(self.firebase_storage_path)
            if not blob.exists():
                print(f"Firebase'de index bulunamadı: {self.firebase_storage_path}")
                return
            zip_bytes = blob.download_as_bytes()
            zip_buffer = io.BytesIO(zip_bytes)
            os.makedirs(self.persistence_path, exist_ok=True)
            with zipfile.ZipFile(zip_buffer, "r") as zf:
                zf.extractall(self.persistence_path)
            print(f"✅ FAISS index Firebase'den indirildi: {self.firebase_storage_path}")
        except Exception as e:
            print(f"⚠️ Firebase'den indirme hatası: {e}")

    def _reset_local_index(self):
        """Bozuk / eski model index'ini temizler."""
        self.vector_store = None
        self.document_registry = {}
        if os.path.exists(self.persistence_path):
            shutil.rmtree(self.persistence_path, ignore_errors=True)
        print("⚠️ FAISS index sıfırlandı.")

    # ------------------------------------------------------------------
    # Yardımcı
    # ------------------------------------------------------------------

    def _save_registry(self):
        if not os.path.exists(self.persistence_path):
            os.makedirs(self.persistence_path)
        with open(self.registry_path, "w", encoding="utf-8") as f:
            json.dump(self.document_registry, f)

    # ------------------------------------------------------------------
    # Ana İşlemler
    # ------------------------------------------------------------------

    def ingest_text(self, text, source_name="unknown"):
        """Metni parçalar, FAISS'e ekler ve Firebase'e yedekler."""
        if not self.embedding_fn:
            return False, "Embedding modeli yüklenemedi."

        try:
            text_splitter = RecursiveCharacterTextSplitter(
                chunk_size=1000,
                chunk_overlap=200,
                separators=["\n\n", "\n", " ", ""]
            )
            chunks = text_splitter.split_text(text)

            if not chunks:
                return False, "Metin parçalanamadı."

            if source_name in self.document_registry:
                self.delete_document(source_name)

            ids = [f"{source_name}_{i}" for i in range(len(chunks))]
            docs = [
                Document(
                    page_content=chunk,
                    metadata={"source": source_name, "chunk_index": i},
                    id=ids[i]
                )
                for i, chunk in enumerate(chunks)
            ]

            if self.vector_store is None:
                self.vector_store = FAISS.from_documents(docs, self.embedding_fn)
            else:
                self.vector_store.add_documents(docs, ids=ids)

            self.document_registry[source_name] = ids
            self._save_registry()
            self.vector_store.save_local(self.persistence_path)
            self._upload_to_firebase()

            return True, f"{len(chunks)} parça başarıyla endekslendi."

        except Exception as e:
            return False, f"Ingestion Hatası: {str(e)}"

    def query(self, question, n_results=3, selected_sources=[]):
        """Soruyla en alakalı metin parçalarını getirir."""
        if self.vector_store is None:
            return []

        try:
            search_kwargs = {"k": n_results}
            if selected_sources:
                filter_func = lambda metadata: metadata["source"] in selected_sources
                search_kwargs["filter"] = filter_func

            docs = self.vector_store.similarity_search(question, **search_kwargs)
            return docs
        except Exception as e:
            print(f"Sorgu Hatası: {str(e)}")
            return []

    def get_full_text(self, selected_sources=[]):
        """Seçili kaynaklara ait tüm metni birleştirerek döndürür."""
        if self.vector_store is None:
            return ""

        full_text = ""
        targets = selected_sources if selected_sources else list(self.document_registry.keys())

        for source in targets:
            if source in self.document_registry:
                ids = self.document_registry[source]
                chunks = []
                for doc_id in ids:
                    try:
                        doc = self.vector_store.docstore.search(doc_id)
                        chunks.append(doc)
                    except Exception:
                        pass

                chunks.sort(key=lambda x: x.metadata.get("chunk_index", 0))
                source_text = "\n".join([c.page_content for c in chunks])
                full_text += f"\n\n--- {source} ---\n{source_text}"

        return full_text

    def get_documents(self):
        """Endekslenmiş dosyaların listesini döner."""
        return list(self.document_registry.keys())

    def delete_document(self, source_name):
        """Belirli bir dosyayı hafızadan siler ve Firebase'i günceller."""
        if source_name not in self.document_registry or self.vector_store is None:
            return False

        try:
            ids_to_delete = self.document_registry[source_name]
            self.vector_store.delete(ids_to_delete)
            del self.document_registry[source_name]
            self._save_registry()
            self.vector_store.save_local(self.persistence_path)
            self._upload_to_firebase()
            return True
        except Exception as e:
            print(f"Silme Hatası: {e}")
            return False

    def clear_memory(self):
        """Tüm hafızayı siler."""
        try:
            self.vector_store = None
            self.document_registry = {}
            if os.path.exists(self.persistence_path):
                shutil.rmtree(self.persistence_path)
            if self.bucket:
                try:
                    blob = self.bucket.blob(self.firebase_storage_path)
                    if blob.exists():
                        blob.delete()
                except Exception:
                    pass
            return True
        except Exception as e:
            print(f"Temizleme Hatası: {e}")
            return False
