import re

with open('backend/core/salary_slip_generator.py', 'r', encoding='utf-8') as f:
    content = f.read()

# Fix 1: Make _convert_to_pdf handle ImportError gracefully
old_convert = '''def _convert_to_pdf(docx_path: str, pdf_path: str):
    """
    Convert DOCX to PDF using docx2pdf (MS Word via COM automation).
    Handles CoInitialize requirement for COM threading.
    """
    import pythoncom
    from docx2pdf import convert'''

new_convert = '''def _convert_to_pdf(docx_path: str, pdf_path: str):
    """
    Convert DOCX to PDF using docx2pdf (MS Word via COM automation).
    Handles CoInitialize requirement for COM threading.
    Raises ImportError if pythoncom/pywin32 is not installed (non-Windows env).
    """
    try:
        import pythoncom
        from docx2pdf import convert
    except ImportError as exc:
        raise ImportError(f"pythoncom/pywin32 or docx2pdf not available: {exc}")'''

if old_convert in content:
    content = content.replace(old_convert, new_convert)
    print('Fixed _convert_to_pdf import handling')
else:
    print('WARNING: _convert_to_pdf pattern not found')

# Fix 2: Replace the PDF conversion + return block
old_block = '''    # 6. Convert to PDF
    try:
        _convert_to_pdf(docx_out, pdf_out)
    except Exception as exc:
        logger.exception("PDF conversion failed: %s", exc)
        return {
            "success": False,
            "errors": [f"PDF conversion failed: {exc}"],
            "filename": None, "filepath": None, "html": None
        }

    # 7. Clean up the intermediate DOCX (keep only the PDF)
    try:
        os.remove(docx_out)
    except Exception:
        pass

    filename = base + ".pdf"
    logger.info("Salary slip ready: %s", pdf_out)
    return {
        "success":  True,
        "errors":   [],
        "filename": filename,
        "filepath": pdf_out,
        "html":     None,   # PDF only'''

new_block = '''    # 6. Convert to PDF (with DOCX fallback for deployment environments
    # without MS Word / pythoncom)
    pdf_created = False
    try:
        _convert_to_pdf(docx_out, pdf_out)
        pdf_created = True
    except ImportError as exc:
        logger.warning("PDF conversion unavailable (pythoncom/pywin32 missing): %s", exc)
    except Exception as exc:
        logger.warning("PDF conversion failed (MS Word may not be installed): %s", exc)

    if pdf_created:
        # 7a. Keep only PDF -- clean up intermediate DOCX
        try:
            os.remove(docx_out)
        except Exception:
            pass
        filename = base + ".pdf"
        filepath = pdf_out
        logger.info("Salary slip PDF ready: %s", filepath)
    else:
        # 7b. Fallback -- return DOCX when PDF conversion is unavailable
        filename = base + ".docx"
        filepath = docx_out
        logger.info("Salary slip DOCX ready (PDF conversion unavailable): %s", filepath)

    return {
        "success":  True,
        "errors":   [],
        "filename": filename,
        "filepath": filepath,
        "html":     None,
    }'''

if old_block in content:
    content = content.replace(old_block, new_block)
    print('Fixed PDF conversion fallback logic')
else:
    print('WARNING: PDF conversion block pattern not found')
    # Debug: show what's around line 470
    lines = content.split('\n')
    for i in range(468, 500):
        if i < len(lines):
            print(f'{i+1}: {repr(lines[i])}')

with open('backend/core/salary_slip_generator.py', 'w', encoding='utf-8') as f:
    f.write(content)
print('Done')
