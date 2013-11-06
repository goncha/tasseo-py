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

render = web.template.render()

urls = (
    '/', 'index',
    '/health', 'health',
    '/(.*)', 'dashboard'
)
app = web.application(urls, globals())


### index class
class index(object):
    def GET(self):
        return render.index(None, None, None)

class health(object):
    def GET(self):
        web.header('Content-Type',
                   'application/json; charset=UTF-8')
        return json.dumps({'status': 'ok'})

class dashboard(object):
    def GET(self, dashboard):
        pass


### Entries of app
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
