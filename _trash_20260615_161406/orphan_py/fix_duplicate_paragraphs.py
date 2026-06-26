from docx import Document
import sys

def remove_duplicate_filler_paragraphs(file_path, output_path):
    print("Loading document...")
    doc = Document(file_path)
    
    paragraphs_to_remove = []
    
    seen_texts = set()
    # We will look for paragraphs that are reasonably long and identical
    # But wait, we added duplicates consecutively in build_massive_report.py
    
    prev_text = None
    duplicate_count = 0
    total_removed = 0
    
    for p in doc.paragraphs:
        text = p.text.strip()
        
        # Only consider paragraphs with significant text as filler candidates
        if len(text) > 100:
            if text == prev_text:
                paragraphs_to_remove.append(p)
                total_removed += 1
            else:
                prev_text = text
        else:
            # We don't remove short things like headings, blanks
            prev_text = text

    print(f"Found {total_removed} duplicate consecutive filler paragraphs.")
    
    # Remove them
    for p in paragraphs_to_remove:
        p._element.getparent().remove(p._element)
        
    doc.save(output_path)
    print(f"Cleaned document saved to {output_path}")

if __name__ == "__main__":
    file_in = "MCA_Project_Report_Massive.docx"
    file_out = "MCA_Project_Report_Massive_Cleaned.docx"
    remove_duplicate_filler_paragraphs(file_in, file_out)
