# -*- coding: utf-8 -*-

import json
import os

import web

# Chdir into this file's directory
module_dir = os.path.dirname(__file__)
if module_dir:
    os.chdir(module_dir)


### web bootstrap
web.config.debug = True

# Use Jinja2 template engine
from web.contrib.template import render_jinja
render = render_jinja(
    'templates',                                        # Template directory
    encoding = 'utf-8'                                  # File charset
)

urls = (
    '/', 'index',
    '/health', 'health',
    '/(.*)', 'dashboard'
)
app = web.application(urls, globals())

### dashboard scanner
dashboards = []
def scan_dashboards(handler):
    dashboards = [ f.split('.')[0] for f in os.listdir('dashboards') if f.endswith('.js') ]
    return handler()
app.add_processor(scan_dashboards)

### index page
class index(object):
    def GET(self):
        return render.index()

### /health
class health(object):
    def GET(self):
        web.header('Content-Type',
                   'application/json; charset=UTF-8')
        return json.dumps({'status': 'ok'})

### /dashboard-name
class dashboard(object):
    def GET(self, dashboard):
        pass


### Entry of app
from web.httpserver import StaticMiddleware

class DashboardsStaticMiddleware(StaticMiddleware):
    def __init__(self, app):
        StaticMiddleware.__init__(self, app, '/dashboards/')


if __name__ == '__main__':
    app.run(DashboardsStaticMiddleware)

# uWSGI requires this variable
application = app.wsgifunc()


# Local Variables: **
# comment-column: 56 **
# indent-tabs-mode: nil **
# python-indent: 4 **
# End: **
