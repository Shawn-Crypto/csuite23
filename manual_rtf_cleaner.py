#!/usr/bin/env python3
"""
Manual Legal Document Cleaner
Manually extracts and cleans legal text from RTF files to preserve exact lawyer content
"""

import re

def extract_clean_text_from_lines(lines):
    """
    Process lines to extract clean text content while preserving exact legal text
    """
    clean_lines = []
    
    for line in lines:
        # Skip RTF control lines
        if line.startswith(('\\rtf', '\\cocoartf', '\\cocoatextscaling', '\\paperw', '\\deftab')):
            continue
        if line.strip().startswith(('{\\fonttbl', '{\\colortbl', '{\\*\\expandedcolortbl')):
            continue
        if re.match(r'^\s*\d+→', line):  # Skip line numbers
            line = re.sub(r'^\s*\d+→', '', line)
        
        # Clean up RTF formatting while preserving text
        line = line.strip()
        if not line or len(line) < 3:
            continue
            
        # Remove RTF control sequences but keep content
        line = re.sub(r'\\[a-zA-Z]+\d*\s*', ' ', line)
        line = line.replace('{', '').replace('}', '')
        line = re.sub(r'\s+', ' ', line).strip()
        
        if line and not line.startswith('\\') and line not in clean_lines:
            clean_lines.append(line)
    
    return clean_lines

def create_final_legal_html(title, clean_text_lines):
    """
    Create the final HTML with pure legal document styling and exact content
    """
    
    html_content = f'''<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{title} - Lotuslion Venture</title>
    <style>
        body {{
            font-family: "Times New Roman", Times, serif;
            background-color: white;
            color: black;
            line-height: 1.6;
            margin: 0;
            padding: 40px;
            font-size: 14px;
        }}
        
        .container {{
            max-width: 900px;
            margin: 0 auto;
            padding: 0 20px;
        }}
        
        h1 {{
            text-align: center;
            font-size: 18px;
            font-weight: bold;
            margin: 40px 0;
            line-height: 1.3;
            text-transform: uppercase;
        }}
        
        .company-info {{
            text-align: center;
            margin: 30px 0;
            font-style: italic;
            font-size: 14px;
        }}
        
        p {{
            margin: 16px 0;
            text-align: justify;
            text-indent: 0;
            line-height: 1.6;
            font-size: 14px;
        }}
        
        .back-link {{
            display: inline-block;
            margin-top: 50px;
            color: black;
            text-decoration: underline;
            font-weight: normal;
        }}
        
        .back-link:hover {{
            text-decoration: none;
        }}
        
        strong {{
            font-weight: bold;
        }}
        
        em {{
            font-style: italic;
        }}
    </style>
</head>
<body>
    <div class="container">
        <h1>{title}</h1>
        
        <div class="company-info">
            <p><strong>LOTUSLION VENTURE LLP</strong></p>
            <p><em>(A Limited Liability Partnership incorporated under the Limited Liability Partnership Act, 2008)</em></p>
        </div>
'''
    
    # Group the text into logical paragraphs
    current_paragraph = ""
    
    for line in clean_text_lines:
        if not line.strip():
            continue
            
        # Check if this should start a new paragraph
        if (line.startswith(('WHEREAS', 'AND WHEREAS', 'NOW THEREFORE', 'ARTICLE', 
                           'PREAMBLE', 'ACCEPTANCE ACKNOWLEDGMENT', 'EFFECTIVE DATE')) or
            re.match(r'^\d+\.\d+', line)):
            # Save current paragraph if it exists
            if current_paragraph.strip():
                html_content += f'        <p>{current_paragraph.strip()}</p>\n'
                current_paragraph = ""
            current_paragraph = line
        else:
            # Continue building current paragraph
            if current_paragraph:
                current_paragraph += " " + line
            else:
                current_paragraph = line
    
    # Don't forget the last paragraph
    if current_paragraph.strip():
        html_content += f'        <p>{current_paragraph.strip()}</p>\n'
    
    html_content += '''
        <a href="index.html" class="back-link">← Back to Course</a>
    </div>
</body>
</html>'''
    
    return html_content

def process_single_file(rtf_file, html_file, title):
    """
    Process a single RTF file into clean HTML
    """
    try:
        print(f"Processing {rtf_file}...")
        
        with open(rtf_file, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Split into lines for processing
        lines = content.split('\n')
        
        # Extract clean text
        clean_lines = extract_clean_text_from_lines(lines)
        
        # Create HTML
        html_content = create_final_legal_html(title, clean_lines)
        
        with open(html_file, 'w', encoding='utf-8') as f:
            f.write(html_content)
        
        print(f"✓ Successfully created {html_file}")
        
    except Exception as e:
        print(f"✗ Error processing {rtf_file}: {str(e)}")

def main():
    """
    Process all legal documents manually for best results
    """
    # At this point, let me just create the clean legal documents manually
    # by extracting the visible text content and formatting it properly
    
    # For now, let's create a simple, clean version focusing on the core legal content
    # This will ensure the lawyer's exact words are preserved
    
    pass  # Will manually create the files below

if __name__ == "__main__":
    main()