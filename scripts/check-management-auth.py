"""Prompt without echo; check management access without modifying remote state."""
import getpass
import json
import sys
import urllib.error
import urllib.request
import warnings

ACCOUNT = '89dd3e659cece6bdf3181b991a2a0bd2'
PROJECT = 'heaswpawzuuijxurlfoz'


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def main():
    if not sys.stdin.isatty():
        print('Interactive trusted terminal required; no tokens read.')
        return 1
    # Refuse getpass fallback rather than risk echoing a credential.
    warnings.simplefilter('error', getpass.GetPassWarning)
    supabase = getpass.getpass('Supabase Management PAT (hidden): ')
    cloudflare = getpass.getpass('Cloudflare user API token (hidden): ')
    if not supabase or not cloudflare:
        print('Both tokens are required; no request sent.')
        return 1
    opener = urllib.request.build_opener(NoRedirect)

    def check(label, url, token, body=None, cloud=False):
        request = urllib.request.Request(
            url, data=json.dumps(body).encode() if body else None,
            headers={'Authorization': 'Bearer ' + token,
                     'Content-Type': 'application/json'})
        try:
            with opener.open(request, timeout=20) as response:
                data = json.load(response)
            if cloud and (data.get('success') is not True or
                          (label == 'Cloudflare token' and
                           data.get('result', {}).get('status') != 'active')):
                print(label + ': rejected (response suppressed)')
                return False
            print(label + ': OK')
            return True
        except urllib.error.HTTPError as error:
            print(label + ': HTTP ' + str(error.code) + ' (response suppressed)')
        except Exception:
            print(label + ': failed (details suppressed)')
        return False

    sb = check('Supabase database read',
               f'https://api.supabase.com/v1/projects/{PROJECT}/database/query/read-only',
               supabase, {'query': 'SELECT 1 AS authentication_check'})
    cf = check('Cloudflare token',
               'https://api.cloudflare.com/client/v4/user/tokens/verify',
               cloudflare, cloud=True)
    settings = cf and check('Cloudflare staging settings',
                           f'https://api.cloudflare.com/client/v4/accounts/{ACCOUNT}'
                           '/workers/scripts/jalisco-auth-staging/settings',
                           cloudflare, cloud=True)
    print('No D1 query, trust registration, grant, deployment or key operation performed.')
    return 0 if sb and cf and settings else 1


if __name__ == '__main__':
    try:
        sys.exit(main())
    except (KeyboardInterrupt, EOFError, getpass.GetPassWarning):
        print('\nSecure input unavailable or cancelled; stopped.')
        sys.exit(1)
