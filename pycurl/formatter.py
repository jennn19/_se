"""Response formatter for pycurl."""

import sys
import json
from .utils import format_size, format_time


class ResponseFormatter:
    """Format and display HTTP responses."""
    
    def __init__(self, options):
        """Initialize formatter with options.
        
        Args:
            options: Dictionary of formatting options
        """
        self.options = options
    
    def format(self, response, output_file=None):
        """Format and display response.
        
        Args:
            response: Response object
            output_file: Optional file path to write output
        """
        opts = self.options
        
        # Print status line and headers if requested
        if opts.get('include_headers'):
            self._print_headers(response)
        
        # Print body
        content = self._decode_content(response.content, response.headers)
        
        if output_file:
            self._write_to_file(output_file, response.content)
        else:
            sys.stdout.write(content)
        
        # Print timing info if verbose
        if opts.get('verbose'):
            self._print_timing(response)
    
    def _print_headers(self, response):
        """Print response status and headers."""
        sys.stderr.write(f"\n< HTTP/1.1 {response.status_code}\n")
        for key, value in response.headers.items():
            sys.stderr.write(f"< {key}: {value}\n")
        sys.stderr.write(f"< \n")
    
    def _decode_content(self, content, headers):
        """Decode response content.
        
        Args:
            content: Raw bytes
            headers: Response headers
            
        Returns:
            Decoded string
        """
        # Try to detect encoding
        content_type = headers.get('Content-Type', '')
        encoding = 'utf-8'
        
        if 'charset=' in content_type:
            encoding = content_type.split('charset=')[-1].strip()
        
        try:
            return content.decode(encoding)
        except (UnicodeDecodeError, LookupError):
            return content.decode('utf-8', errors='replace')
    
    def _write_to_file(self, path, content):
        """Write content to file.
        
        Args:
            path: File path
            content: Content to write
        """
        with open(path, 'wb') as f:
            f.write(content)
        sys.stderr.write(f"Written to {path}\n")
    
    def _print_timing(self, response):
        """Print timing information."""
        sys.stderr.write(f"\n* Total time: {format_time(response.elapsed)}\n")
        sys.stderr.write(f"* Size: {format_size(len(response.content))}\n")
    
    def print_version(self):
        """Print version information."""
        from . import __version__
        sys.stderr.write(f"pycurl {__version__} (Python {sys.version.split()[0]})\n")
        sys.stderr.write(f"Features: HTTPS, HTTP/1.1, compression\n")
    
    def print_help(self):
        """Print help message."""
        help_text = """
Usage: pycurl [options] <url>

Options:
  -X, --request <method>   HTTP method to use (default: GET)
  -H, --header <header>    Add header (can be used multiple times)
  -d, --data <data>        Send data in request body
  -G, --get                Force GET method
  -o, --output <file>      Write output to file
  -i, --include            Include response headers in output
  -v, --verbose            Verbose output
  -L, --location           Follow redirects
  -k, --insecure           Allow insecure SSL connections
  -u, --user <user:pass>   Basic authentication
  -F, --form <name=val>    Send form data
  --json <data>            Send JSON data
  -e, --referer <url>      Set Referer header
  -A, --user-agent <ua>    Set User-Agent header
  --compressed             Accept compressed response
  -c, --cookie <cookies>   Send cookies
  --cookie-jar <file>      Save cookies to file
  --max-time <seconds>     Maximum time allowed
  -x, --proxy <proxy>      Use proxy
  -s, --silent             Silent mode
  --connect-timeout <s>    Connection timeout
  -I, --head               Fetch headers only (HEAD)
  --version                Show version
  
Examples:
  pycurl https://api.example.com
  pycurl -X POST -d '{"name":"test"}' https://api.example.com
  pycurl -H "Authorization: Bearer token" https://api.example.com
  pycurl -o output.json https://api.example.com/data
  pycurl -v -L https://example.com
"""
        sys.stdout.write(help_text)
