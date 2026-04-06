import os
import shutil
import json
from langchain_community.vectorstores import FAISS
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_core.documents import Document

class RAGService:
    def __init__(self, persistence_path="./faiss_index"):
        """
        RAG Servisi Başlatıcı (Gelişmiş Yönetim Modu).
        """
        self.persistence_path = persistence_path
        self.registry_path = os.path.join(persistence_path, "registry.json")
        self.vector_store = None
        self.document_registry = {} # { "filename.pdf": [id1, id2, id3] }

        # 1. Embedding Fonksiyonunu Hazırla
        try:
            self.embedding_fn = HuggingFaceEmbeddings(
                model_name="all-MiniLM-L6-v2"
            )
        except Exception as e:
            print(f"Model yükleme hatası: {e}")
            self.embedding_fn = None

        
        print(f"DEBUG: RAGService initialized. Path: {self.persistence_path}, Registry loaded: {list(self.document_registry.keys())}")

        # 2. Varsa eski indeksi ve kayıt defterini yükle
        if os.path.exists(self.persistence_path):
            try:
                self.vector_store = FAISS.load_local(
                    self.persistence_path, 
                    self.embedding_fn,
                    allow_dangerous_deserialization=True
                )
                # Registry yükle
                if os.path.exists(self.registry_path):
                    with open(self.registry_path, "r", encoding="utf-8") as f:
                        self.document_registry = json.load(f)
            except:
                self.vector_store = None
                self.document_registry = {}

    def _save_registry(self):
        if not os.path.exists(self.persistence_path):
            os.makedirs(self.persistence_path)
        with open(self.registry_path, "w", encoding="utf-8") as f:
            json.dump(self.document_registry, f)

    def ingest_text(self, text, source_name="unknown"):
        """
        Metni parçalar, kaydeder ve kayıt defterine işler.
        """
        if not self.embedding_fn:
            return False, "Embedding modeli yüklenemedi."

        try:

            # A. Metni Parçalara Böl
            text_splitter = RecursiveCharacterTextSplitter(
                chunk_size=1000,
                chunk_overlap=200,
                separators=["\n\n", "\n", " ", ""]
            )
            chunks = text_splitter.split_text(text)
            
            if not chunks:
                return False, "Metin parçalanamadı."

            # B. ID ve Metadata Hazırla
            # Eğer dosya zaten varsa önce eskileri temizle (update mantığı)
            if source_name in self.document_registry:
                self.delete_document(source_name)

            ids = [f"{source_name}_{i}" for i in range(len(chunks))]
            docs = [
                Document(page_content=chunk, metadata={"source": source_name, "chunk_index": i}, id=ids[i]) 
                for i, chunk in enumerate(chunks)
            ]
            
            # C. Vektör Veritabanına Ekle
            if self.vector_store is None:
                self.vector_store = FAISS.from_documents(docs, self.embedding_fn)
            else:
                self.vector_store.add_documents(docs, ids=ids)
            
            # D. Kayıt Defterini Güncelle
            self.document_registry[source_name] = ids
            self._save_registry()
            
            # E. Diske Kaydet
            self.vector_store.save_local(self.persistence_path)
            
            return True, f"{len(chunks)} parça başarıyla endekslendi."
            
        except Exception as e:
            return False, f"Ingestion Hatası: {str(e)}"


    def query(self, question, n_results=3, selected_sources=[]):
        """
        Soruyla en alakalı metin parçalarını getirir.
        selected_sources: Sadece bu listedeki dosyalarda ara. Boşsa hepsinde ara.
        """
        if self.vector_store is None:
            return []
            
        try:
            # Filtreleme Mantığı
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
        """
        Seçili kaynaklara ait tüm metni (chunkları birleştirerek) döndürür.
        Full Context işlemleri (Sınav, Özet) için kullanılır.
        """
        if self.vector_store is None:
            return ""
            
        full_text = ""
        
        # Eğer kaynak seçilmediyse hepsini al
        targets = selected_sources if selected_sources else list(self.document_registry.keys())
        
        for source in targets:
            if source in self.document_registry:
                ids = self.document_registry[source]
                
                # Belge parçalarını topla
                chunks = []
                for doc_id in ids:
                    try:
                        # FAISS in-memory docstore'dan ID ile çekme
                        doc = self.vector_store.docstore.search(doc_id)
                        chunks.append(doc)
                    except:
                        pass # Silinmiş veya bulunamamış olabilir
                
                # chunk_index'e göre sırala ki metin karışmasın
                chunks.sort(key=lambda x: x.metadata.get('chunk_index', 0))
                
                # Birleştir
                source_text = "\n".join([c.page_content for c in chunks])
                full_text += f"\n\n--- {source} ---\n{source_text}"
                
        return full_text

    def get_documents(self):
        """
        Endekslenmiş dosyaların listesini döner.
        """
        return list(self.document_registry.keys())

    def delete_document(self, source_name):
        """
        Belirli bir dosyayı hafızadan siler.
        """
        if source_name not in self.document_registry or self.vector_store is None:
            return False

        try:
            ids_to_delete = self.document_registry[source_name]
            self.vector_store.delete(ids_to_delete)
            del self.document_registry[source_name]
            self._save_registry()
            self.vector_store.save_local(self.persistence_path)
            # Not: FAISS delete işlemi bazen index'i rebuild gerektirebilir ama
            # LangChain wrapper'ı bunu yönetir.
            return True
        except Exception as e:
            print(f"Silme Hatası: {e}")
            return False

    def clear_memory(self):
        """
        Tüm hafızayı siler.
        """
        try:
            self.vector_store = None
            self.document_registry = {}
            if os.path.exists(self.persistence_path):
                shutil.rmtree(self.persistence_path)
            return True
        except Exception as e:
            return False
