#!/usr/bin/env python3
"""
Advanced RTF Content Processor for Legal Documents
Properly extracts and formats legal text from RTF files while preserving lawyer's exact content
"""

import re

def clean_rtf_content(content):
    """
    Advanced RTF processing to extract clean legal text while preserving structure
    """
    
    # Step 1: Remove RTF header and setup
    content = re.sub(r'\\rtf1[^}]*', '', content)
    content = re.sub(r'\\cocoartf\d+', '', content)
    content = re.sub(r'\\cocoatextscaling\d+\\cocoaplatform\d+', '', content)
    content = re.sub(r'\{\\fonttbl[^}]*\}+', '', content)
    content = re.sub(r'\{\\colortbl[^}]*\}+', '', content)
    content = re.sub(r'\{\\.*?expandedcolortbl[^}]*\}+', '', content)
    
    # Step 2: Clean up page layout and paragraph controls
    content = re.sub(r'\\paperw\d+\\paperh\d+\\margl\d+\\margr\d+\\vieww\d+\\viewh\d+\\viewkind\d+', '', content)
    content = re.sub(r'\\deftab\d+', '', content)
    
    # Step 3: Process paragraph markers and formatting
    content = re.sub(r'\\pard[^\\]*', '\n\nPARA_BREAK\n', content)
    content = re.sub(r'\\pardeftab\w*\d*[^\\]*', '', content)
    
    # Step 4: Handle font and formatting
    content = re.sub(r'\\f0\\b\\fs\d+', 'BOLD_START', content)
    content = re.sub(r'\\f0\\b(?!\\)', 'BOLD_START', content)
    content = re.sub(r'\\f1\\b0', 'BOLD_END', content)
    content = re.sub(r'\\f2\\i', 'ITALIC_START', content)
    content = re.sub(r'\\f1\\i0', 'ITALIC_END', content)
    
    # Step 5: Remove other formatting codes
    content = re.sub(r'\\f\d+', '', content)
    content = re.sub(r'\\fs\d+', '', content)
    content = re.sub(r'\\cf\d+', '', content)  
    content = re.sub(r'\\strokec\d+', '', content)
    content = re.sub(r'\\expnd\d+\\expndtw\d+\\kerning\d+', '', content)
    content = re.sub(r'\\outl\d+\\strokewidth\d+', '', content)
    
    # Step 6: Handle special characters
    content = content.replace('\\uc0\\u8377', '₹')  # Rupee symbol
    content = content.replace('\\uc0\\u8232', '\n')  # Line separator
    
    # Step 7: Clean up backslashes and braces
    content = re.sub(r'\\[a-zA-Z]+\d*\s*', ' ', content)  # Remove RTF commands
    content = content.replace('{', '').replace('}', '')
    content = content.replace('\\', '\n')
    
    # Step 8: Process into clean paragraphs
    lines = []
    for line in content.split('\n'):
        line = line.strip()
        
        # Skip empty lines and control sequences
        if not line or line.startswith('PARA_BREAK') or len(line) < 3:
            if line.startswith('PARA_BREAK'):
                lines.append('')  # Add paragraph break
            continue
            
        # Handle formatting markers
        line = line.replace('BOLD_START', '<strong>')
        line = line.replace('BOLD_END', '</strong>')
        line = line.replace('ITALIC_START', '<em>')
        line = line.replace('ITALIC_END', '</em>')
        
        # Clean up any remaining artifacts
        line = re.sub(r'\s+', ' ', line)  # Normalize whitespace
        line = re.sub(r'^[*\s]+', '', line)  # Remove leading asterisks/spaces
        
        if line:
            lines.append(line)
    
    return '\n'.join(lines)

def structure_legal_document(content, title):
    """
    Structure the cleaned content into proper legal document format
    """
    
    paragraphs = []
    current_para = ""
    
    for line in content.split('\n'):
        line = line.strip()
        
        if not line:
            # Empty line indicates paragraph break
            if current_para:
                paragraphs.append(current_para.strip())
                current_para = ""
        else:
            # Accumulate text for current paragraph
            if current_para:
                current_para += " " + line
            else:
                current_para = line
    
    # Don't forget the last paragraph
    if current_para:
        paragraphs.append(current_para.strip())
    
    # Now create the clean HTML
    html_parts = []
    
    for para in paragraphs:
        if para.strip():
            # Clean up any remaining artifacts
            para = re.sub(r'\s+', ' ', para)
            
            # Handle common legal formatting patterns
            if para.startswith(('WHEREAS', 'AND WHEREAS', 'NOW THEREFORE')):
                para = f"<strong>{para.split()[0]}</strong> {' '.join(para.split()[1:])}"
            
            # Handle article headers
            if para.startswith('ARTICLE') and ':' in para:
                para = f"<strong>{para}</strong>"
            
            # Handle numbered sections
            if re.match(r'^\d+\.\d+', para):
                parts = para.split(' ', 1)
                if len(parts) > 1:
                    para = f"<strong>{parts[0]} {parts[1].split()[0]}</strong> {' '.join(parts[1].split()[1:])}"
            
            html_parts.append(para)
    
    return html_parts

def create_clean_legal_html(title, paragraphs):
    """
    Create clean HTML with pure legal document styling
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
            padding: 0;
        }}
        
        h1 {{
            text-align: center;
            font-size: 20px;
            font-weight: bold;
            margin: 40px 0;
            line-height: 1.3;
            text-transform: uppercase;
        }}
        
        .company-info {{
            text-align: center;
            margin: 30px 0;
            font-style: italic;
        }}
        
        p {{
            margin: 16px 0;
            text-align: justify;
            text-indent: 0;
            line-height: 1.6;
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
    
    # Add all paragraphs
    for para in paragraphs:
        if para.strip():
            html_content += f'        <p>{para}</p>\n'
    
    html_content += '''
        <a href="index.html" class="back-link">← Back to Course</a>
    </div>
</body>
</html>'''
    
    return html_content

def main():
    """
    Process all three legal documents
    """
    
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
        
        try:
            # Read RTF content
            with open(file_info['rtf_file'], 'r', encoding='utf-8') as f:
                rtf_content = f.read()
            
            # Clean the RTF content
            cleaned_content = clean_rtf_content(rtf_content)
            
            # Structure into legal document format
            paragraphs = structure_legal_document(cleaned_content, file_info['title'])
            
            # Create final HTML
            html_content = create_clean_legal_html(file_info['title'], paragraphs)
            
            # Write the clean HTML file
            with open(file_info['html_file'], 'w', encoding='utf-8') as f:
                f.write(html_content)
            
            print(f"✓ Successfully created {file_info['html_file']} with {len(paragraphs)} paragraphs")
            
        except Exception as e:
            print(f"✗ Error processing {file_info['rtf_file']}: {str(e)}")

if __name__ == "__main__":
    main()