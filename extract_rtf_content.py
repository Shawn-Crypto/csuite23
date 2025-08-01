#!/usr/bin/env python3
"""
RTF Content Extractor for Legal Documents
Extracts exact text content from RTF files while preserving legal formatting
"""

import re
import html

def extract_rtf_text(rtf_content):
    """
    Extract plain text from RTF content while preserving structure and formatting.
    This preserves the lawyer's exact words, punctuation, and structure.
    """
    
    # Remove RTF header and control sequences
    text = rtf_content
    
    # Remove RTF control group declarations
    text = re.sub(r'\\rtf1[^}]*}', '', text)
    text = re.sub(r'\\cocoartf\d+', '', text)
    text = re.sub(r'\\cocoatextscaling\d+\\cocoaplatform\d+', '', text)
    
    # Remove font table
    text = re.sub(r'\\fonttbl[^}]*}+', '', text)
    
    # Remove color table  
    text = re.sub(r'\\colortbl[^}]*}+', '', text)
    text = re.sub(r'\\expandedcolortbl[^}]*}+', '', text)
    
    # Remove page layout controls
    text = re.sub(r'\\paperw\d+\\paperh\d+\\margl\d+\\margr\d+\\vieww\d+\\viewh\d+\\viewkind\d+', '', text)
    text = re.sub(r'\\deftab\d+', '', text)
    
    # Remove paragraph formatting controls but preserve breaks
    text = re.sub(r'\\pard[^\\]*', '\n\n', text)
    text = re.sub(r'\\pardeftab\d+[^\\]*', '', text)
    
    # Handle font changes - preserve bold markers
    text = re.sub(r'\\f0\\b\\fs\d+', '**BOLD**', text)
    text = re.sub(r'\\f0\\b', '**BOLD**', text)
    text = re.sub(r'\\f1\\b0', '**NORMAL**', text)
    text = re.sub(r'\\f2\\i', '**ITALIC**', text)
    text = re.sub(r'\\f1\\i0', '**NORMAL**', text)
    
    # Remove other font controls
    text = re.sub(r'\\f\d+', '', text)
    text = re.sub(r'\\fs\d+', '', text)
    
    # Remove color and styling controls
    text = re.sub(r'\\cf\d+', '', text)
    text = re.sub(r'\\strokec\d+', '', text)
    text = re.sub(r'\\expnd\d+\\expndtw\d+\\kerning\d+', '', text)
    text = re.sub(r'\\outl\d+\\strokewidth\d+', '', text)
    
    # Handle line breaks and special characters
    text = text.replace('\\uc0\\u8377', '₹')  # Rupee symbol
    text = text.replace('\\uc0\\u8232', '\n')  # Line separator
    text = text.replace('\\', '\n')  # General line breaks
    
    # Clean up excessive whitespace while preserving structure
    text = re.sub(r'\n{3,}', '\n\n', text)
    text = re.sub(r' {2,}', ' ', text)
    
    # Remove any remaining RTF controls
    text = re.sub(r'\\[a-zA-Z]+\d*', '', text)
    text = re.sub(r'[{}]', '', text)
    
    # Clean up the extracted text
    lines = []
    for line in text.split('\n'):
        line = line.strip()
        if line and not line.startswith('{') and not line.startswith('}'):
            # Handle bold/italic markers
            line = re.sub(r'\*\*BOLD\*\*([^*]*)\*\*NORMAL\*\*', r'<strong>\1</strong>', line)
            line = re.sub(r'\*\*ITALIC\*\*([^*]*)\*\*NORMAL\*\*', r'<em>\1</em>', line)
            line = re.sub(r'\*\*BOLD\*\*', '<strong>', line)
            line = re.sub(r'\*\*NORMAL\*\*', '</strong>', line)
            line = re.sub(r'\*\*ITALIC\*\*', '<em>', line)
            
            if line:
                lines.append(line)
    
    return '\n'.join(lines)

def create_legal_html(title, content, filename):
    """
    Create HTML file with pure legal document styling
    """
    
    # Process content into proper HTML paragraphs
    paragraphs = []
    current_para = ""
    
    for line in content.split('\n'):
        line = line.strip()
        if not line:
            if current_para:
                paragraphs.append(current_para)
                current_para = ""
        else:
            if current_para:
                current_para += " " + line
            else:
                current_para = line
    
    if current_para:
        paragraphs.append(current_para)
    
    # Generate HTML content
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
            line-height: 1.5;
            margin: 0;
            padding: 40px;
            font-size: 14px;
        }}
        
        .container {{
            max-width: 800px;
            margin: 0 auto;
            padding: 0 20px;
        }}
        
        h1 {{
            text-align: center;
            font-size: 18px;
            font-weight: bold;
            margin: 30px 0;
            line-height: 1.3;
        }}
        
        p {{
            margin: 12px 0;
            text-align: justify;
            text-indent: 0;
        }}
        
        .back-link {{
            display: inline-block;
            margin-top: 40px;
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
'''
    
    # Add all paragraphs
    for para in paragraphs:
        if para.strip():
            # Escape HTML but preserve our formatting tags
            para = html.escape(para, quote=False)
            para = para.replace('&lt;strong&gt;', '<strong>').replace('&lt;/strong&gt;', '</strong>')
            para = para.replace('&lt;em&gt;', '<em>').replace('&lt;/em&gt;', '</em>')
            html_content += f'        <p>{para}</p>\n'
    
    html_content += '''
        <a href="index.html" class="back-link">← Back to Course</a>
    </div>
</body>
</html>'''
    
    return html_content

# Read RTF files and extract content
def main():
    files_to_process = [
        {
            'rtf_file': 'TERMS AND CONDITIONS OF SERVICE.txt',
            'html_file': 'terms.html',
            'title': 'TERMS AND CONDITIONS OF SERVICE'
        },
        {
            'rtf_file': 'PRIVACY AND DATA PROTECTION POLICY.txt', 
            'html_file': 'privacy.html',
            'title': 'PRIVACY AND DATA PROTECTION POLICY'
        },
        {
            'rtf_file': 'POLICY FOR REFUND, RESTITUTION AND REVERSAL OF PECUNIARY CONSIDERATION.txt',
            'html_file': 'refund.html',
            'title': 'POLICY FOR REFUND, RESTITUTION AND REVERSAL OF PECUNIARY CONSIDERATION'
        }
    ]
    
    for file_info in files_to_process:
        print(f"Processing {file_info['rtf_file']}...")
        
        # Read RTF content
        with open(file_info['rtf_file'], 'r', encoding='utf-8') as f:
            rtf_content = f.read()
        
        # Extract text
        extracted_text = extract_rtf_text(rtf_content)
        
        # Create HTML
        html_content = create_legal_html(file_info['title'], extracted_text, file_info['html_file'])
        
        # Write HTML file
        with open(file_info['html_file'], 'w', encoding='utf-8') as f:
            f.write(html_content)
        
        print(f"Created {file_info['html_file']}")

if __name__ == "__main__":
    main()