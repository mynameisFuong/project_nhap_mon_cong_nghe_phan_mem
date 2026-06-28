from zipfile import ZipFile

p = "Bao_cao_do_an_Phan_mem_diem_danh_sinh_vien.docx"
xml = ZipFile(p).read("word/document.xml").decode("utf-8")
for label, token in [
    ("heading1", "Heading1"),
    ("heading2", "Heading2"),
    ("heading3", "Heading3"),
    ("tables", "<w:tbl>"),
    ("page_breaks", 'w:type="page"'),
    ("placeholder_count", "Chèn"),
    ("sectPr", "<w:sectPr"),
]:
    print(label, xml.count(token))
