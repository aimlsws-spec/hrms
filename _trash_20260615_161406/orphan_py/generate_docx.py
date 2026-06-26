import codecs
import re
from docx import Document
from docx.shared import Pt, Inches
from docx.enum.text import WD_ALIGN_PARAGRAPH

def process_bold_text(paragraph, text):
    parts = re.split(r'(\*\*.*?\*\*)', text)
    for part in parts:
        if part.startswith('**') and part.endswith('**'):
            run = paragraph.add_run(part[2:-2])
            run.bold = True
        else:
            paragraph.add_run(part)

def convert_md_to_docx(md_path, docx_path):
    try:
        doc = Document()
        
        # Set default font
        style = doc.styles['Normal']
        font = style.font
        font.name = 'Times New Roman'
        font.size = Pt(12)
        
        with codecs.open(md_path, 'r', 'utf-8') as f:
            lines = f.readlines()
            
        for line in lines:
            line = line.strip()
            if not line:
                continue
            
            if line == '---' or line == '***':
                doc.add_page_break()
                continue
                
            if line.startswith('# '):
                p = doc.add_paragraph()
                p.alignment = WD_ALIGN_PARAGRAPH.CENTER
                run = p.add_run(line[2:].replace('**', ''))
                run.bold = True
                run.font.size = Pt(16)
            elif line.startswith('## '):
                p = doc.add_paragraph()
                run = p.add_run(line[3:].replace('**', ''))
                run.bold = True
                run.font.size = Pt(14)
            elif line.startswith('### '):
                p = doc.add_paragraph()
                run = p.add_run(line[4:].replace('**', ''))
                run.bold = True
                run.font.size = Pt(13)
            elif line.startswith('- '):
                p = doc.add_paragraph(style='List Bullet')
                process_bold_text(p, line[2:])
            elif line.startswith('1.') or line.startswith('2.') or line.startswith('3.') or line.startswith('4.') or line.startswith('5.') or line.startswith('6.') or line.startswith('7.') or line.startswith('8.') or line.startswith('9.'):
                p = doc.add_paragraph(style='List Number')
                process_bold_text(p, line)
            elif line.startswith('*') and line.endswith('*') and not line.startswith('**'):
                p = doc.add_paragraph()
                p.alignment = WD_ALIGN_PARAGRAPH.CENTER
                run = p.add_run(line[1:-1])
                run.italic = True
            else:
                p = doc.add_paragraph()
                if line.startswith('**') and line.endswith('**'):
                     p.alignment = WD_ALIGN_PARAGRAPH.CENTER
                process_bold_text(p, line)
                
        doc.save(docx_path)
        print("Successfully generated " + docx_path)
    except Exception as e:
        print("Error: " + str(e))

if __name__ == "__main__":
    convert_md_to_docx("MCA_Project_Report_Draft.md", "MCA_Project_Report.docx")
