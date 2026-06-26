from docx import Document
from docx.shared import Pt
from docx.enum.text import WD_ALIGN_PARAGRAPH

def add_references_section(input_path, output_path):
    print("Loading document...")
    doc = Document(input_path)
    
    # We want to insert the References section right before the "EXTENDED ABSTRACT" heading.
    target_idx = -1
    for i, p in enumerate(doc.paragraphs):
        if "EXTENDED ABSTRACT" in p.text.strip():
            target_idx = i
            break
            
    if target_idx == -1:
        print("Warning: Could not find EXTENDED ABSTRACT heading. Appending to end of document.")
        target_p = doc.add_paragraph()
    else:
        # Create a new paragraph and insert it before the EXTENDED ABSTRACT
        # Actually, let's insert a page break first
        target_p = doc.paragraphs[target_idx]
        pb = target_p.insert_paragraph_before()
        from docx.enum.text import WD_BREAK
        pb.add_run().add_break(WD_BREAK.PAGE)
        
        target_p = pb

    # Now add the references
    def insert_heading(text, level=1):
        if target_idx != -1:
            p = target_p.insert_paragraph_before(text)
            try:
                p.style = doc.styles[f'Heading {level}']
            except KeyError:
                pass
            p.alignment = WD_ALIGN_PARAGRAPH.CENTER
            p.runs[0].bold = True
            p.runs[0].font.size = Pt(16)
            return p
        else:
            p = doc.add_heading(text, level=level)
            p.alignment = WD_ALIGN_PARAGRAPH.CENTER
            return p

    def insert_paragraph(text, style=None, bold_prefix=None):
        if target_idx != -1:
            p = target_p.insert_paragraph_before()
            if style:
                try:
                    p.style = doc.styles[style]
                except:
                    pass
            
            if bold_prefix:
                p.add_run(bold_prefix).bold = True
                p.add_run(text[len(bold_prefix):])
            else:
                p.add_run(text)
            return p
        else:
            p = doc.add_paragraph()
            if style:
                try:
                    p.style = doc.styles[style]
                except:
                    pass
            if bold_prefix:
                p.add_run(bold_prefix).bold = True
                p.add_run(text[len(bold_prefix):])
            else:
                p.add_run(text)
            return p

    insert_heading("REFERENCES", level=1)
    insert_paragraph("") # Space
    
    references_data = [
        ("1. FastAPI and Python Documentation:", [
            "FastAPI Official Documentation. Available at: https://fastapi.tiangolo.com/",
            "Python Software Foundation. \"Python 3.11.x Documentation.\" Available at: https://docs.python.org/3/"
        ]),
        ("2. MySQL Database Design and Best Practices:", [
            "MySQL Documentation. \"MySQL 8.0 Reference Manual.\" Available at: https://dev.mysql.com/doc/refman/8.0/en/",
            "Ramakrishnan, R., & Gehrke, J. (2003). \"Database Management Systems.\" McGraw-Hill."
        ]),
        ("3. REST API Design Principles:", [
            "Richardson, L., & Amundsen, M. (2013). \"RESTful Web APIs.\" O'Reilly Media.",
            "OWASP Foundation. \"OWASP API Security Top 10.\" Available at: https://owasp.org/www-project-api-security/"
        ]),
        ("4. Human Resource Management Systems Literature:", [
            "Cascio, W. F., & Aguinis, H. (2019). \"Applied Psychology in Talent Management.\" SAGE Publications.",
            "Bhattacharyya, D. K. (2011). \"Human Resource Management.\" Excel Books."
        ]),
        ("5. AI/ML and Natural Language Processing Resources:", [
            "Géron, A. (2019). \"Hands-On Machine Learning with Scikit-Learn, Keras, and TensorFlow.\" O'Reilly Media.",
            "Jurafsky, D., & Martin, J. H. (2009). \"Speech and Language Processing: An Introduction to Natural Language Processing, Computational Linguistics, and Speech Recognition.\" Prentice Hall."
        ]),
        ("6. Web Development Frameworks and Technologies:", [
            "Mozilla Developer Network (MDN) Web Docs. \"HTML, CSS, and JavaScript Tutorials.\" Available at: https://developer.mozilla.org/en-US/",
            "W3C (World Wide Web Consortium). \"Web Standards.\" Available at: https://www.w3.org/standards/webdesign/"
        ]),
        ("7. Security and Authentication Standards:", [
            "IETF. \"RFC 6749: The OAuth 2.0 Authorization Framework.\" Available at: https://www.rfc-editor.org/rfc/rfc6749",
            "OWASP Foundation. \"OWASP Top 10 Web Application Security Risks.\" Available at: https://owasp.org/www-project-top-ten/"
        ]),
        ("8. Project Management and Software Engineering Methodologies:", [
            "Pressman, R. S., & Maxim, B. R. (2019). \"Software Engineering: A Practitioner's Approach.\" McGraw-Hill Education.",
            "Schwaber, K., & Sutherland, J. (2020). \"The Scrum Guide.\" Scrum.org."
        ])
    ]
    
    for category, refs in references_data:
        insert_paragraph(category, bold_prefix=category)
        for ref in refs:
            p = insert_paragraph("• " + ref)
            p.paragraph_format.left_indent = Pt(36) # Indent the bullet points
        insert_paragraph("") # Space
        
    doc.save(output_path)
    print(f"Successfully added References and saved to {output_path}!")

if __name__ == "__main__":
    add_references_section("MCA_Project_Report_.docx", "MCA_Project_Report_Final.docx")
