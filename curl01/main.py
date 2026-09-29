#!/usr/bin/env python3
"""
pycurl - A curl-like HTTP client written in Python.

Usage:
    python main.py [options] <url>

Examples:
    python main.py https://httpbin.org/get
    python main.py -X POST -d '{"name":"test"}' https://httpbin.org/post
    python main.py -H "Authorization: Bearer token" https://httpbin.org/headers
"""

import sys
from pycurl.cli import parse_args, build_options
from pycurl.client import HTTPClient
from pycurl.formatter import ResponseFormatter
from pycurl.utils import print_error


def main(argv=None):
    """Main entry point.
    
    Args:
        argv: Command line arguments (defaults to sys.argv[1:])
    """
    try:
        args = parse_args(argv)
    except SystemExit:
        return 1
    
    # Handle special flags
    if args.version:
        formatter = ResponseFormatter({})
        formatter.print_version()
        return 0
    
    if args.help:
        formatter = ResponseFormatter({})
        formatter.print_help()
        return 0
    
    # Check URL
    if not args.url:
        print_error("No URL specified")
        print_error("Try 'pycurl --help' for more information.")
        return 1
    
    # Build options
    options = build_options(args)
    
    # Create formatter
    formatter = ResponseFormatter(options)
    
    # Create client and make request
    client = HTTPClient(options)
    
    try:
        response = client.request(options['method'], args.url)
        formatter.format(response, output_file=options.get('output'))
        return 0 if response.status_code < 400 else 1
    except ConnectionError as e:
        print_error(str(e))
        return 1
    except KeyboardInterrupt:
        print_error("\nInterrupted")
        return 130
    except Exception as e:
        print_error(f"Unexpected error: {e}")
        return 1
    finally:
        client.close()


if __name__ == '__main__':
    sys.exit(main())
