"""Basic tests for pycurl."""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from pycurl.cli import parse_args, build_options
from pycurl.utils import parse_headers, parse_cookies, parse_form_data
from pycurl.client import HTTPClient
from pycurl.formatter import ResponseFormatter


def test_parse_args():
    """Test argument parsing."""
    # Basic GET
    args = parse_args(['https://example.com'])
    assert args.url == 'https://example.com'
    assert args.method == 'GET'
    
    # POST with data
    args = parse_args(['-X', 'POST', '-d', 'key=value', 'https://example.com'])
    assert args.method == 'POST'
    assert args.data == ['key=value']
    
    # Headers
    args = parse_args(['-H', 'Content-Type: application/json', 'https://example.com'])
    assert args.header == ['Content-Type: application/json']
    
    # Verbose
    args = parse_args(['-v', 'https://example.com'])
    assert args.verbose is True
    
    # Multiple options
    args = parse_args(['-X', 'DELETE', '-v', '-L', 'https://example.com'])
    assert args.method == 'DELETE'
    assert args.verbose is True
    assert args.location is True
    
    print("[PASS] parse_args tests passed")


def test_parse_headers():
    """Test header parsing."""
    headers = parse_headers(['Content-Type: application/json', 'Authorization: Bearer token'])
    assert headers['Content-Type'] == 'application/json'
    assert headers['Authorization'] == 'Bearer token'
    
    # Empty list
    assert parse_headers([]) == {}
    
    # Invalid header (no colon)
    headers = parse_headers(['invalid'])
    assert 'invalid' not in headers
    
    print("[PASS] parse_headers tests passed")


def test_parse_cookies():
    """Test cookie parsing."""
    cookies = parse_cookies('name1=value1; name2=value2')
    assert cookies['name1'] == 'value1'
    assert cookies['name2'] == 'value2'
    
    # Empty
    assert parse_cookies('') == {}
    assert parse_cookies(None) == {}
    
    print("[PASS] parse_cookies tests passed")


def test_parse_form_data():
    """Test form data parsing."""
    data = parse_form_data(['name=test', 'age=25'])
    assert data['name'] == 'test'
    assert data['age'] == '25'
    
    print("[PASS] parse_form_data tests passed")


def test_build_options():
    """Test options building."""
    args = parse_args([
        '-X', 'POST',
        '-d', 'data=test',
        '-H', 'Content-Type: application/json',
        '-v',
        '-L',
        'https://example.com'
    ])
    
    options = build_options(args)
    assert options['method'] == 'POST'
    assert options['verbose'] is True
    assert options['follow_redirects'] is True
    assert options['headers']['Content-Type'] == 'application/json'
    assert options['data'] == 'data=test'
    
    print("[PASS] build_options tests passed")


def test_http_client():
    """Test HTTP client creation."""
    options = {
        'method': 'GET',
        'verbose': False,
        'headers': {},
        'timeout': (5, 30),
        'user_agent': 'pycurl/test',
    }
    
    client = HTTPClient(options)
    assert client.session is not None
    client.close()
    
    print("[PASS] HTTPClient tests passed")


def test_formatter():
    """Test formatter creation."""
    options = {
        'verbose': True,
        'include_headers': True,
    }
    
    formatter = ResponseFormatter(options)
    assert formatter.options == options
    
    print("[PASS] ResponseFormatter tests passed")


if __name__ == '__main__':
    test_parse_args()
    test_parse_headers()
    test_parse_cookies()
    test_parse_form_data()
    test_build_options()
    test_http_client()
    test_formatter()
    print("\n[PASS] All tests passed!")
