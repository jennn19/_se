"""HTTP client implementation for pycurl."""

import time
import sys
from urllib.parse import urlparse
import requests


class Response:
    """HTTP response wrapper."""
    
    def __init__(self, status_code, headers, content, elapsed, url):
        self.status_code = status_code
        self.headers = headers
        self.content = content
        self.elapsed = elapsed
        self.url = url


class HTTPClient:
    """HTTP client that mimics curl behavior."""
    
    def __init__(self, options):
        """Initialize HTTP client with options.
        
        Args:
            options: Dictionary of client options
        """
        self.options = options
        self.session = requests.Session()
        self._setup_session()
    
    def _setup_session(self):
        """Setup session with default options."""
        opts = self.options
        
        # SSL verification
        self.session.verify = not opts.get('insecure', False)
        
        # Proxy
        if opts.get('proxy'):
            self.session.proxies = {
                'http': opts['proxy'],
                'https': opts['proxy']
            }
        
        # Timeout
        self.session.timeout = opts.get('timeout', (5, 30))
        
        # Default headers
        headers = opts.get('headers', {})
        
        # User agent
        if 'User-Agent' not in headers:
            headers['User-Agent'] = opts.get('user_agent', 'pycurl/1.0.0')
        
        # Accept encoding
        if opts.get('compressed'):
            headers['Accept-Encoding'] = 'gzip, deflate'
        
        # Referer
        if opts.get('referer'):
            headers['Referer'] = opts['referer']
        
        self.session.headers.update(headers)
        
        # Cookies
        if opts.get('cookies'):
            self.session.cookies.update(opts['cookies'])
        
        # Basic auth
        if opts.get('user'):
            parts = opts['user'].split(':', 1)
            username = parts[0]
            password = parts[1] if len(parts) > 1 else ''
            self.session.auth = (username, password)
    
    def request(self, method, url):
        """Send HTTP request.
        
        Args:
            method: HTTP method (GET, POST, etc.)
            url: Target URL
            
        Returns:
            Response object
        """
        opts = self.options
        
        # Ensure URL has scheme
        if not url.startswith(('http://', 'https://')):
            url = 'http://' + url
        
        # Prepare request kwargs
        kwargs = {
            'allow_redirects': opts.get('follow_redirects', False),
            'stream': opts.get('stream', False),
        }
        
        # Request body
        data = opts.get('data')
        json_data = opts.get('json_data')
        form_data = opts.get('form_data')
        files = opts.get('files')
        
        if json_data:
            kwargs['json'] = json_data
        elif data:
            kwargs['data'] = data
        elif form_data:
            kwargs['data'] = form_data
        elif files:
            kwargs['files'] = files
        
        # Verbose output
        if opts.get('verbose'):
            self._print_request(method, url, kwargs)
        
        # Send request
        start_time = time.time()
        try:
            resp = self.session.request(method, url, **kwargs)
            elapsed = time.time() - start_time
            
            # Handle redirects manually if needed
            if opts.get('follow_redirects') and opts.get('verbose'):
                self._print_redirects(resp)
            
            return Response(
                status_code=resp.status_code,
                headers=dict(resp.headers),
                content=resp.content,
                elapsed=elapsed,
                url=resp.url
            )
        except requests.exceptions.RequestException as e:
            elapsed = time.time() - start_time
            raise ConnectionError(f"Failed to connect: {e}")
    
    def _print_request(self, method, url, kwargs):
        """Print request details in verbose mode."""
        sys.stderr.write(f"* Trying to connect...\n")
        sys.stderr.write(f"* Connected to {urlparse(url).hostname}\n")
        sys.stderr.write(f"> {method} {urlparse(url).path or '/'} HTTP/1.1\n")
        sys.stderr.write(f"> Host: {urlparse(url).hostname}\n")
        
        for key, value in self.session.headers.items():
            sys.stderr.write(f"> {key}: {value}\n")
        
        if kwargs.get('json'):
            sys.stderr.write(f"> Content-Type: application/json\n")
        elif kwargs.get('data'):
            sys.stderr.write(f"> Content-Type: application/x-www-form-urlencoded\n")
        
        sys.stderr.write(f"> \n")
    
    def _print_redirects(self, resp):
        """Print redirect information."""
        history = resp.history
        if history:
            sys.stderr.write(f"< HTTP/1.1 {history[-1].status_code} Redirect\n")
            sys.stderr.write(f"< Location: {resp.headers.get('Location', 'N/A')}\n")
    
    def close(self):
        """Close the session."""
        self.session.close()
