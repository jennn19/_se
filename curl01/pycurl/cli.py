"""Command-line interface for pycurl."""

import sys
import argparse
from .utils import (
    parse_headers, parse_cookies, parse_form_data,
    parse_json_data, read_file, read_binary_file, print_error
)


def parse_args(argv=None):
    """Parse command-line arguments.
    
    Args:
        argv: Argument list (defaults to sys.argv[1:])
        
    Returns:
        Parsed arguments namespace
    """
    parser = argparse.ArgumentParser(
        prog='pycurl',
        description='A curl-like HTTP client written in Python',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        add_help=False
    )
    
    parser.add_argument(
        'url',
        nargs='?',
        help='Target URL'
    )
    
    # Request method
    parser.add_argument(
        '-X', '--request',
        dest='method',
        default='GET',
        help='HTTP method (default: GET)'
    )
    
    # Headers
    parser.add_argument(
        '-H', '--header',
        action='append',
        default=[],
        help='Add request header'
    )
    
    # Request body
    parser.add_argument(
        '-d', '--data',
        action='append',
        default=[],
        help='Send data in request body'
    )
    
    # JSON data
    parser.add_argument(
        '--json',
        dest='json_data',
        help='Send JSON data'
    )
    
    # Form data
    parser.add_argument(
        '-F', '--form',
        action='append',
        default=[],
        help='Send form data'
    )
    
    # Output
    parser.add_argument(
        '-o', '--output',
        help='Write output to file'
    )
    
    # Include headers
    parser.add_argument(
        '-i', '--include',
        action='store_true',
        help='Include response headers'
    )
    
    # Verbose
    parser.add_argument(
        '-v', '--verbose',
        action='store_true',
        help='Verbose output'
    )
    
    # Follow redirects
    parser.add_argument(
        '-L', '--location',
        action='store_true',
        help='Follow redirects'
    )
    
    # Insecure
    parser.add_argument(
        '-k', '--insecure',
        action='store_true',
        help='Allow insecure SSL connections'
    )
    
    # Authentication
    parser.add_argument(
        '-u', '--user',
        help='Basic authentication (user:password)'
    )
    
    # Referer
    parser.add_argument(
        '-e', '--referer',
        help='Set Referer header'
    )
    
    # User agent
    parser.add_argument(
        '-A', '--user-agent',
        default='pycurl/1.0.0',
        help='Set User-Agent header'
    )
    
    # Compressed
    parser.add_argument(
        '--compressed',
        action='store_true',
        help='Accept compressed response'
    )
    
    # Cookies
    parser.add_argument(
        '-c', '--cookie',
        action='append',
        default=[],
        help='Send cookies'
    )
    
    # Cookie jar
    parser.add_argument(
        '--cookie-jar',
        help='Save cookies to file'
    )
    
    # Timeout
    parser.add_argument(
        '--max-time',
        type=float,
        default=30,
        help='Maximum time allowed (seconds)'
    )
    
    # Connect timeout
    parser.add_argument(
        '--connect-timeout',
        type=float,
        default=5,
        help='Connection timeout (seconds)'
    )
    
    # Proxy
    parser.add_argument(
        '-x', '--proxy',
        help='Use proxy'
    )
    
    # Silent
    parser.add_argument(
        '-s', '--silent',
        action='store_true',
        help='Silent mode'
    )
    
    # HEAD request
    parser.add_argument(
        '-I', '--head',
        action='store_true',
        help='Fetch headers only (HEAD)'
    )
    
    # Version
    parser.add_argument(
        '--version',
        action='store_true',
        help='Show version'
    )
    
    # Help
    parser.add_argument(
        '-h', '--help',
        action='store_true',
        help='Show help'
    )
    
    # Data binary
    parser.add_argument(
        '--data-binary',
        dest='data_binary',
        help='Send binary data'
    )
    
    # URL file
    parser.add_argument(
        '-K', '--config',
        help='Read config from file'
    )
    
    args = parser.parse_args(argv)
    
    return args


def build_options(args):
    """Build options dictionary from parsed arguments.
    
    Args:
        args: Parsed arguments namespace
        
    Returns:
        Dictionary of options
    """
    options = {
        'method': args.method.upper(),
        'verbose': args.verbose,
        'include_headers': args.include,
        'follow_redirects': args.location,
        'insecure': args.insecure,
        'compressed': args.compressed,
        'silent': args.silent,
        'user_agent': args.user_agent,
        'timeout': (args.connect_timeout, args.max_time),
    }
    
    # Headers
    options['headers'] = parse_headers(args.header)
    
    # Data
    if args.data:
        options['data'] = '&'.join(args.data)
    
    # JSON data
    if args.json_data:
        options['json_data'] = parse_json_data(args.json_data)
    
    # Form data
    if args.form:
        options['form_data'] = parse_form_data(args.form)
    
    # Binary data
    if args.data_binary:
        if args.data_binary.startswith('@'):
            file_path = args.data_binary[1:]
            try:
                options['data'] = read_binary_file(file_path)
            except FileNotFoundError as e:
                print_error(str(e))
                sys.exit(1)
        else:
            options['data'] = args.data_binary
    
    # Auth
    if args.user:
        options['user'] = args.user
    
    # Referer
    if args.referer:
        options['referer'] = args.referer
    
    # Cookies
    if args.cookie:
        cookie_dict = {}
        for cookie_str in args.cookie:
            cookie_dict.update(parse_cookies(cookie_str))
        options['cookies'] = cookie_dict
    
    # Proxy
    if args.proxy:
        options['proxy'] = args.proxy
    
    # HEAD method
    if args.head:
        options['method'] = 'HEAD'
    
    # Output
    if args.output:
        options['output'] = args.output
    
    return options
