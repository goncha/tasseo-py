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


### Use Jinja2 template engine
class render_jinja:
    def __init__(self, *a, **kwargs):
        extensions = kwargs.pop('extensions', [])
        globals = kwargs.pop('globals', {})

        from jinja2 import Environment,FileSystemLoader
        self._lookup = Environment(loader=FileSystemLoader(*a, **kwargs),
                                   extensions=extensions,
                                   autoescape=True,
                                   trim_blocks=True,
                                   lstrip_blocks=True)
        self._lookup.globals.update(globals)

    def __getattr__(self, name):
        # Assuming all templates end with .html
        path = name + '.html'
        t = self._lookup.get_template(path)
        return t.render

render = render_jinja(
    'templates',                                        # Template directory
    encoding = 'utf-8',                                 # File charset
    globals = { 'environ' : os.environ },               # Global variables
    extensions = ['jinja2.ext.autoescape']              # Jinja2 extensions
)

urls = (
    '/', 'index',
    '/health', 'health',
    '/(.*)', 'dashboard'
)
app = web.application(urls, globals())

### dashboard scanner
def scan_dashboards(handler):
    web.ctx.dashboards = []
    web.ctx.dashboards = [ f.split('.')[0] for f in os.listdir('dashboards') \
                           if f.endswith('.js') ]
    return handler()
app.add_processor(scan_dashboards)

### helper
def accept_content(content_type):
    http_accept = web.ctx.env['HTTP_ACCEPT']
    return http_accept and \
        content_type in [x.split(';')[0] for x in http_accept.split(',')]


### index page
import web.webapi
NoContent = web.webapi._status_code("204 No Content")

class index(object):
    def GET(self):
        if len(web.ctx.dashboards) > 0:
            if accept_content('application/json'):
                web.header('Content-Type',
                           'application/json; charset=UTF-8')
                return json.dumps({'dashboards': web.ctx.dashboards})
            else:
                return render.index(dashboard=None,
                                    dashboards=web.ctx.dashboards,
                                    error=None)
        else:
            if accept_content('application/json'):
                web.header('Content-Type',
                           'application/json; charset=UTF-8')
                raise NoContent()
            else:
                return render.index(dashboard=None,
                                    dashboards=None,
                                    error='No dashboard files found.')
### /health
class health(object):
    def GET(self):
        web.header('Content-Type',
                   'application/json; charset=UTF-8')
        return json.dumps({'status': 'ok'})

### /dashboard-name
class dashboard(object):
    def GET(self, dashboard):
        if not os.environ.has_key('GRAPHITE_URL'):
            web.ctx.status = '500 Internal Server Error'
            return render.index(dashboard=None,
                                dashboards=None,
                                error='GRAPHITE_URL has not been set.')
        if dashboard not in web.ctx.dashboards:
            web.ctx.status = '404 Not Found'
            return render.index(dashboard=None,
                                dashboards=None,
                                error='That dashboard does not exist.')
        return render.index(dashboard=dashboard,
                            dashboards=None,
                            error=None)


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
