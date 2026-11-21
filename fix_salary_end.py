with open('backend/core/salary_slip_generator.py', 'rb') as f:
    content = f.read()

# Find and remove the corrupted trailing text
bad = b'\xe2\x80\x94 no generic HTML fallback\r\n    }\r\n'
if bad in content:
    content = content.replace(bad, b'\r\n')
    print('Fixed corrupted trailing text')
else:
    print('Pattern not found, trying alternate')
    # Try with just newline (not \r\n)
    bad2 = b'\xe2\x80\x94 no generic HTML fallback\n    }\n'
    if bad2 in content:
        content = content.replace(bad2, b'\n')
        print('Fixed alternate pattern')
    else:
        print('Still not found, printing last 200 bytes:')
        print(repr(content[-200:]))

with open('backend/core/salary_slip_generator.py', 'wb') as f:
    f.write(content)
print('Done')
