from docx import Document
from docx.shared import Pt
import re

def expand_company_profile(file_path):
    print("Loading document...")
    doc = Document(file_path)
    
    # We will locate the heading "1.1 Company Profile", delete the subsequent paragraphs until "1.2 Project Objective",
    # and insert a comprehensive 2-page profile of Seawind Solution.
    
    start_idx = -1
    end_idx = -1
    
    for i, p in enumerate(doc.paragraphs):
        text = p.text.strip()
        if text.startswith("1.1 Company Profile"):
            start_idx = i
        if text.startswith("1.2 Project Objective"):
            end_idx = i
            break
            
    if start_idx == -1 or end_idx == -1:
        print("Error: Could not locate sections 1.1 or 1.2")
        return
        
    # We remove the filler paragraphs in between
    for i in range(start_idx + 1, end_idx):
        p = doc.paragraphs[start_idx + 1]
        p._element.getparent().remove(p._element)

    # Now, insert our massive Seawind Solution Profile before 1.2
    target_p = doc.paragraphs[start_idx + 1] # This is now "1.2 Project Objective" because we deleted the stuff before it
    
    content = [
        "Seawind Solution Pvt. Ltd. is a premier IT services, web solutions, and digital marketing company founded in 2009. Headquartered in Ahmedabad, Gujarat, India, the company has established a formidable international presence, including extensive operations reaching out to the UK and various global markets. Over the past decade and a half, Seawind Solution has forged a reputation for delivering end-to-end digital transformation pipelines catered towards startups, Small and Medium Enterprises (SMEs), and large-scale corporate entities.",
        "The company's primary corporate mission focuses on bridging the gap between legacy corporate management techniques and modern, cutting-edge software solutions. By adopting scalable web technologies, cloud computing infrastructures, and rapid microservices deployment models, Seawind Solution operates using agile development methodologies designed to ship robust B2B and B2C platforms with absolute precision.",
        "Core Service Offerings:",
        "1. Web Services & Development: Seawind specializes in bespoke web design, custom CMS development, and high-performance server-side application building. Their solutions focus on responsive architectures ensuring that digital platforms scale flawlessly regardless of the client-end viewport.",
        "2. Software & AI Solutions: The company is aggressively pushing the boundaries of custom software development, expanding into Artificial Intelligence (AI) and Machine Learning (ML) solutions. This academic HRMS project—which seamlessly integrates conversational AI—is a testament to Seawind's forward-thinking technological ideology.",
        "3. IT Infrastructure & Hosting: Ensuring 99.9% uptime, Seawind provides highly secure web hosting solutions including Managed WordPress, Cloud Hosting, Managed VPS (Linux and Windows), and dedicated server clusters. They handle domain registrations and SSL certificate provisions acting as a one-stop-shop for corporate digital presence.",
        "4. Digital Marketing & Branding: Recognizing that software must be seen to be utilized, Seawind offers holistic digital marketing strategies including Search Engine Optimization (SEO), Pay-Per-Click (PPC) campaigns, Google Ads management, graphic design, 3D animations, and multimedia presentations.",
        "5. Business Communication Tools: Seawind maintains aggressive communication infrastructures providing Bulk SMS functionality, WhatsApp Business API integrations, Enterprise Email services, and digital Visitor Management systems.",
        "6. Offshore Staffing: The company provides dedicated developers and offshore staffing alternatives, allowing international clients to rapidly scale their development teams efficiently.",
        "Work Culture and Environment:",
        "At Seawind Solution Pvt. Ltd., the work culture is inherently tied to continuous learning and technological adaptation. The environment actively encourages software engineers and developers to research and implement the latest tech stacks—such as FastAPI, Next.js, and Cloud-Native database solutions. It was within this innovative ecosystem that the necessity for the \"AI-Powered HRMS Portal\" was conceived. As the firm's operations scaled exponentially, the internal administrative bottlenecks commonly associated with attendance tracking, performance reviews, and manual payroll math began to strain the HR department.",
        "Why the AI-Powered HRMS Portal?",
        "To uphold their commitment to technological excellence, Seawind Solution required an internal tool that reflected their external product quality. The legacy systems used for managing employee data were decentralized. The AI-Powered HRMS Portal was thus commissioned as an internally facing product designed to unify these processes. The inclusion of the AI Chatbot directly mirrors Seawind's initiative to integrate Artificial Intelligence into daily workflows, thereby reducing the cognitive load on the HR department and allowing the company to focus aggressively on client satisfaction and market scaling.",
        "The subsequent chapters of this report detail the rigorous software engineering lifecycle employed to deliver this corporate portal back to Seawind Solution, serving as a live integration of advanced academic theory within a high-stakes, real-world corporate environment."
    ]
    
    for text in content:
        new_p = target_p.insert_paragraph_before()
        if text.endswith(":") and " " not in text.strip()[:-1]: # simple heuristic for headings
             pass # just write normal
        
        # apply formatting
        new_p.alignment = 3 # Justify
        run = new_p.add_run(text)
        
        if ":" in text and sum(c.isdigit() for c in text[:2]) > 0: # Like "1. Web Services:"
             bold_part = text.split(":")[0] + ":"
             normal_part = text[len(bold_part):]
             new_p.text = ""
             new_p.add_run(bold_part).bold = True
             new_p.add_run(normal_part)
        elif text in ["Core Service Offerings:", "Work Culture and Environment:", "Why the AI-Powered HRMS Portal?"]:
             new_p.text = ""
             r = new_p.add_run(text)
             r.bold = True
             r.underline = True

    doc.save("MCA_Project_Report_Seawind.docx")
    print("Successfully injected extensive Seawind Solution internal profile!")

if __name__ == "__main__":
    expand_company_profile("MCA_Project_Report_Massive_Cleaned.docx")
