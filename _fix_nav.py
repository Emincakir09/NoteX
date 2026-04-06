import re

content = open('main.py', encoding='utf-8').read()

# Find and replace the broken block using line-based approach
lines = content.split('\n')

# Find the start and end lines of the broken block
start_idx = None
end_idx = None
for i, line in enumerate(lines):
    if '# Tek HTML blo' in line and 'sabit y' in line:
        start_idx = i
    if start_idx and i > start_idx and line.strip() == ')':
        # End of the list comprehension block
        end_idx = i
        break

print(f"Block found: lines {start_idx}-{end_idx}")

if start_idx is not None and end_idx is not None:
    new_block = [
        "    nav_cards_html = \"\"",
        "    _nav_sel = \".nb-trigger-row\"",
        "    _nav_btns = \"querySelectorAll('button')\"",
        "    for _i, (_pid, _icon, _title, _desc) in enumerate(pages):",
        "        _active_cls = \"nb-active\" if _pid == st.session_state.active_page else \"\"",
        "        _js = \"(function(){document.querySelector('\" + _nav_sel + \"').\" + _nav_btns + \"[\" + str(_i) + \"].click();})()\",",
        "        nav_cards_html += (",
        "            '<div class=\"nb-card ' + _active_cls + '\" onclick=\"' + _js[0] + '\">',",
        "            '<div class=\"nb-icon\">' + _icon + '</div>',",
        "            '<div class=\"nb-title\">' + _title + '</div>',",
        "            '<div class=\"nb-desc\">' + _desc + '</div>',",
        "            '</div>'",
        "        )",
    ]
    # Actually let's use a simpler clean replacement
    new_block = '''    # Nav HTML oluştur (backslash yok, değişken tabanlı)
    _nav_sel = ".nb-trigger-row"
    _nav_btns = "querySelectorAll(\\'button\\')"
    nav_cards_html = ""
    for _i, (_pid, _icon, _title, _desc) in enumerate(pages):
        _active_cls = "nb-active" if _pid == st.session_state.active_page else ""
        _onclick = "document.querySelector('" + _nav_sel + "')." + _nav_btns + "[" + str(_i) + "].click()"
        nav_cards_html += (
            '<div class="nb-card ' + _active_cls + '" onclick="(function(){' + _onclick + '})()">'
            + '<div class="nb-icon">' + _icon + '</div>'
            + '<div class="nb-title">' + _title + '</div>'
            + '<div class="nb-desc">' + _desc + '</div>'
            + '</div>'
        )'''

    # Find the second block (the "Python f-string için aktif durumu" block) 
    # and replace both blocks together
    second_start = None
    second_end = None
    for i, line in enumerate(lines):
        if '# Python f-string' in line and 'aktif durum' in line:
            second_start = i
        if second_start and i > second_start and line.strip() == ')':
            second_end = i
            break

    print(f"Second block: lines {second_start}-{second_end}")
    
    if second_end:
        # Replace from start_idx to second_end (inclusive)
        new_lines = lines[:start_idx] + new_block.split('\n') + lines[second_end+1:]
        open('main.py', 'w', encoding='utf-8').write('\n'.join(new_lines))
        print("DONE - file written")
    else:
        print("Second block end not found")
else:
    print("Block NOT FOUND")
    # Print context around line 1283
    for i in range(1280, 1295):
        if i < len(lines):
            print(f"{i+1}: {lines[i][:80]}")
