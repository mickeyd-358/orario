def get_calendar_navigation(year, month):
    """
    Calculates the previous and next month/year pagination values.

    Args:
        - year (int): The current year.
        - month (int): The current month.
    Returns:
        - tuple: (prev_year, prev_month, next_year, next_month)
    """
    if month > 1:
        prev_month, prev_year = month - 1, year
    else:
        prev_month, prev_year = 12, year - 1
    
    if month < 12:
        next_month, next_year = month + 1, year
    else:
        next_month, next_year = 1, year + 1
        
    return prev_year, prev_month, next_year, next_month

import os

from docx import Document
from pypdf import PdfReader

MAX_API_CHARS = 7000 
MAX_TEXT_SIZE = 5 * 1024 * 1024 # 5MB absolute RAM safety guardrail

def extract_text_for_ai(file_path, allowed_directory):
    """
    Safely parses .txt, .pdf, and .docx documents. Enforces both absolute
    system memory boundaries and strict 7,000-character constraints for API stability.
    """
    try:
        # Prevent Path Traversal by locking processing strictly inside active temp folder
        abs_allowed_dir = os.path.abspath(allowed_directory)
        abs_file_path = os.path.abspath(file_path)
        
        if not abs_file_path.startswith(abs_allowed_dir + os.sep):
            raise PermissionError("Access Denied: Path outside verified runtime bounds.")
            
        if not os.path.exists(abs_file_path):
            return ""

        ext = os.path.splitext(abs_file_path)[1].lower()
        raw_text = ""
        
        if ext == '.txt':
            if os.path.getsize(abs_file_path) > MAX_TEXT_SIZE:
                raise ValueError("File exceeds maximum allowed size limits.")
            with open(abs_file_path, 'r', encoding='utf-8') as f:
                raw_text = f.read()
                
        elif ext == '.pdf':
            reader = PdfReader(abs_file_path)
            pages_text = []
            for page in reader.pages:
                pages_text.append(page.extract_text() or "")
            raw_text = "".join(pages_text)
            
        elif ext == '.docx':
            doc = Document(abs_file_path)
            raw_text = "\n".join([p.text for p in doc.paragraphs])
        else:
            return "" # Unsupported extension file type
            
        # Enforce strict 7,000 character limit to keep API payload stable
        if len(raw_text) > MAX_API_CHARS:
            # Drop slightly below the maximum threshold limit to account for truncation text padding
            truncated = raw_text[:MAX_API_CHARS - 100]
            last_space = truncated.rfind(' ')
            if last_space != -1:
                truncated = truncated[:last_space]
            return truncated + "\n\n[... Text truncated by system due to context limit ...]"
            
        return raw_text

    except Exception as e:
        print(f"Extraction execution crash intercepted: {e}")
        return ""