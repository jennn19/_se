"""Utility functions for pycurl."""

import json
import sys
import os


def parse_headers(headers_list):
    """Parse header list into dict.
    
    Args:
        headers_list: List of 'Key: Value' strings
        
    Returns:
        Dictionary of headers
    """
    headers = {}
    for h in headers_list:
        if ':' in h:
            key, value = h.split(':', 1)
            headers[key.strip()] = value.strip()
    return headers


def parse_cookies(cookie_str):
    """Parse cookie string into dict.
    
    Args:
        cookie_str: Cookie string like 'name1=value1; name2=value2'
        
    Returns:
        Dictionary of cookies
    """
    cookies = {}
    if not cookie_str:
        return cookies
    
    for pair in cookie_str.split(';'):
        pair = pair.strip()
        if '=' in pair:
            name, value = pair.split('=', 1)
            cookies[name.strip()] = value.strip()
    return cookies


def parse_form_data(form_list):
    """Parse form data list into dict.
    
    Args:
        form_list: List of 'name=value' strings
        
    Returns:
        Dictionary of form fields
    """
    data = {}
    for item in form_list:
        if '=' in item:
            name, value = item.split('=', 1)
            data[name] = value
    return data


def parse_json_data(json_str):
    """Parse JSON string.
    
    Args:
        json_str: JSON string
        
    Returns:
        Parsed JSON data
        
    Raises:
        ValueError: If JSON is invalid
    """
    try:
        return json.loads(json_str)
    except json.JSONDecodeError as e:
        raise ValueError(f"Invalid JSON: {e}")


def read_file(path):
    """Read file content.
    
    Args:
        path: File path
        
    Returns:
        File content as string
        
    Raises:
        FileNotFoundError: If file doesn't exist
    """
    if not os.path.exists(path):
        raise FileNotFoundError(f"File not found: {path}")
    with open(path, 'r', encoding='utf-8') as f:
        return f.read()


def read_binary_file(path):
    """Read binary file content.
    
    Args:
        path: File path
        
    Returns:
        File content as bytes
        
    Raises:
        FileNotFoundError: If file doesn't exist
    """
    if not os.path.exists(path):
        raise FileNotFoundError(f"File not found: {path}")
    with open(path, 'rb') as f:
        return f.read()


def write_to_file(path, content):
    """Write content to file.
    
    Args:
        path: File path
        content: Content to write (string or bytes)
    """
    mode = 'wb' if isinstance(content, bytes) else 'w'
    encoding = None if isinstance(content, bytes) else 'utf-8'
    with open(path, mode, encoding=encoding) as f:
        f.write(content)


def format_size(size_bytes):
    """Format bytes to human readable size.
    
    Args:
        size_bytes: Size in bytes
        
    Returns:
        Formatted string
    """
    for unit in ['B', 'KB', 'MB', 'GB', 'TB']:
        if size_bytes < 1024:
            return f"{size_bytes:.1f}{unit}"
        size_bytes /= 1024
    return f"{size_bytes:.1f}PB"


def format_time(seconds):
    """Format seconds to human readable time.
    
    Args:
        seconds: Time in seconds
        
    Returns:
        Formatted string
    """
    if seconds < 0.001:
        return f"{seconds * 1000000:.0f}us"
    elif seconds < 1:
        return f"{seconds * 1000:.1f}ms"
    elif seconds < 60:
        return f"{seconds:.2f}s"
    else:
        minutes = int(seconds // 60)
        secs = seconds % 60
        return f"{minutes}m {secs:.1f}s"


def print_error(message):
    """Print error message to stderr.
    
    Args:
        message: Error message
    """
    print(f"pycurl: {message}", file=sys.stderr)


def print_verbose(message):
    """Print verbose message to stderr.
    
    Args:
        message: Verbose message
    """
    print(message, file=sys.stderr)
