'use strict'

const t = require('tap')
const test = t.test
const sget = require('simple-get').concat
const Fastify = require('..')

const payload = { hello: 'world' }

test('hooks', t => {
  t.plan(21)
  const fastify = Fastify()

  try {
    fastify.addHook('preHandler', function (request, reply, next) {
      request.test = 'the request is coming'
      reply.test = 'the reply has come'
      if (request.raw.method === 'HEAD') {
        next(new Error('some error'))
      } else {
        next()
      }
    })
    t.pass()
  } catch (e) {
    t.fail()
  }

  try {
    fastify.addHook('onRequest', function (req, res, next) {
      req.raw = 'the request is coming'
      res.raw = 'the reply has come'
      if (req.method === 'DELETE') {
        next(new Error('some error'))
      } else {
        next()
      }
    })
    t.pass()
  } catch (e) {
    t.fail()
  }

  fastify.addHook('onResponse', function (res, next) {
    t.ok('onResponse called')
    next()
  })

  fastify.addHook('onSend', function (req, reply, thePayload, next) {
    t.ok('onSend called')
    next()
  })

  fastify.get('/', function (req, reply) {
    t.is(req.raw.raw, 'the request is coming')
    t.is(reply.res.raw, 'the reply has come')
    t.is(req.test, 'the request is coming')
    t.is(reply.test, 'the reply has come')
    reply.code(200).send(payload)
  })

  fastify.head('/', function (req, reply) {
    reply.code(200).send(payload)
  })

  fastify.delete('/', function (req, reply) {
    reply.code(200).send(payload)
  })

  fastify.listen(0, err => {
    t.error(err)
    fastify.server.unref()

    sget({
      method: 'GET',
      url: 'http://localhost:' + fastify.server.address().port
    }, (err, response, body) => {
      t.error(err)
      t.strictEqual(response.statusCode, 200)
      t.strictEqual(response.headers['content-length'], '' + body.length)
      t.deepEqual(JSON.parse(body), { hello: 'world' })
    })

    sget({
      method: 'HEAD',
      url: 'http://localhost:' + fastify.server.address().port
    }, (err, response, body) => {
      t.error(err)
      t.strictEqual(response.statusCode, 500)
    })

    sget({
      method: 'DELETE',
      url: 'http://localhost:' + fastify.server.address().port
    }, (err, response, body) => {
      t.error(err)
      t.strictEqual(response.statusCode, 500)
    })
  })
})

test('onRequest hook should support encapsulation / 1', t => {
  t.plan(3)
  const fastify = Fastify()

  fastify.register((instance, opts, next) => {
    instance.addHook('onRequest', () => {})
    t.is(instance._hooks.onRequest.length, 1)
    next()
  })

  fastify.ready(err => {
    t.error(err)
    t.is(fastify._hooks.onRequest.length, 0)
  })
})

test('onRequest hook should support encapsulation / 2', t => {
  t.plan(3)
  const fastify = Fastify()

  fastify.addHook('onRequest', () => {})

  fastify.register((instance, opts, next) => {
    instance.addHook('onRequest', () => {})
    t.is(instance._hooks.onRequest.length, 2)
    next()
  })

  fastify.ready(err => {
    t.error(err)
    t.is(fastify._hooks.onRequest.length, 1)
  })
})

test('onRequest hook should support encapsulation / 3', t => {
  t.plan(20)
  const fastify = Fastify()
  fastify.decorate('hello', 'world')

  fastify.addHook('onRequest', function (req, res, next) {
    t.ok(this.hello)
    t.ok(this.hello2)
    req.first = true
    next()
  })

  fastify.decorate('hello2', 'world')

  fastify.get('/first', (req, reply) => {
    t.ok(req.raw.first)
    t.notOk(req.raw.second)
    reply.send({ hello: 'world' })
  })

  fastify.register((instance, opts, next) => {
    instance.decorate('hello3', 'world')
    instance.addHook('onRequest', function (req, res, next) {
      t.ok(this.hello)
      t.ok(this.hello2)
      t.ok(this.hello3)
      req.second = true
      next()
    })

    instance.get('/second', (req, reply) => {
      t.ok(req.raw.first)
      t.ok(req.raw.second)
      reply.send({ hello: 'world' })
    })

    next()
  })

  fastify.listen(0, err => {
    t.error(err)
    fastify.server.unref()

    sget({
      method: 'GET',
      url: 'http://localhost:' + fastify.server.address().port + '/first'
    }, (err, response, body) => {
      t.error(err)
      t.strictEqual(response.statusCode, 200)
      t.strictEqual(response.headers['content-length'], '' + body.length)
      t.deepEqual(JSON.parse(body), { hello: 'world' })
    })

    sget({
      method: 'GET',
      url: 'http://localhost:' + fastify.server.address().port + '/second'
    }, (err, response, body) => {
      t.error(err)
      t.strictEqual(response.statusCode, 200)
      t.strictEqual(response.headers['content-length'], '' + body.length)
      t.deepEqual(JSON.parse(body), { hello: 'world' })
    })
  })
})

test('preHandler hook should support encapsulation / 5', t => {
  t.plan(17)
  const fastify = Fastify()
  fastify.decorate('hello', 'world')

  fastify.addHook('preHandler', function (req, res, next) {
    t.ok(this.hello)
    req.first = true
    next()
  })

  fastify.get('/first', (req, reply) => {
    t.ok(req.first)
    t.notOk(req.second)
    reply.send({ hello: 'world' })
  })

  fastify.register((instance, opts, next) => {
    instance.decorate('hello2', 'world')
    instance.addHook('preHandler', function (req, res, next) {
      t.ok(this.hello)
      t.ok(this.hello2)
      req.second = true
      next()
    })

    instance.get('/second', (req, reply) => {
      t.ok(req.first)
      t.ok(req.second)
      reply.send({ hello: 'world' })
    })

    next()
  })

  fastify.listen(0, err => {
    t.error(err)
    fastify.server.unref()

    sget({
      method: 'GET',
      url: 'http://localhost:' + fastify.server.address().port + '/first'
    }, (err, response, body) => {
      t.error(err)
      t.strictEqual(response.statusCode, 200)
      t.strictEqual(response.headers['content-length'], '' + body.length)
      t.deepEqual(JSON.parse(body), { hello: 'world' })
    })

    sget({
      method: 'GET',
      url: 'http://localhost:' + fastify.server.address().port + '/second'
    }, (err, response, body) => {
      t.error(err)
      t.strictEqual(response.statusCode, 200)
      t.strictEqual(response.headers['content-length'], '' + body.length)
      t.deepEqual(JSON.parse(body), { hello: 'world' })
    })
  })
})

test('onRoute hook should be called / 1', t => {
  t.plan(2)
  const fastify = Fastify()

  fastify.register((instance, opts, next) => {
    instance.addHook('onRoute', () => {
      t.pass()
    })
    instance.get('/', opts, function (req, reply) {
      reply.send()
    })
    next()
  })

  fastify.ready(err => {
    t.error(err)
  })
})

test('onRoute hook should be called / 2', t => {
  t.plan(5)
  let firstHandler = 0
  let secondHandler = 0
  const fastify = Fastify()
  fastify.addHook('onRoute', (route) => {
    t.pass()
    firstHandler++
  })

  fastify.register((instance, opts, next) => {
    instance.addHook('onRoute', (route) => {
      t.pass()
      secondHandler++
    })
    instance.get('/', opts, function (req, reply) {
      reply.send()
    })
    next()
  })
  .after(() => {
    t.strictEqual(firstHandler, 1)
    t.strictEqual(secondHandler, 1)
  })

  fastify.ready(err => {
    t.error(err)
  })
})

test('onRoute hook should be called / 3', t => {
  t.plan(6)
  const fastify = Fastify()

  function handler (req, reply) {
    reply.send()
  }

  fastify.addHook('onRoute', (route) => {
    t.pass()
  })

  fastify.register((instance, opts, next) => {
    instance.addHook('onRoute', (route) => {
      t.pass()
    })
    instance.get('/a', handler)
    next()
  })
  .after((err, done) => {
    t.error(err)
    setTimeout(() => {
      fastify.get('/b', handler)
      done()
    }, 10)
  })

  fastify.ready(err => {
    t.error(err)
  })
})

test('onRoute should keep the context', t => {
  t.plan(4)
  const fastify = Fastify()
  fastify.register((instance, opts, next) => {
    instance.decorate('test', true)
    instance.addHook('onRoute', onRoute)
    t.ok(instance.prototype === fastify.prototype)

    function onRoute (route) {
      t.ok(this.test)
      t.strictEqual(this, instance)
    }

    instance.get('/', opts, function (req, reply) {
      reply.send()
    })

    next()
  })

  fastify.close((err) => {
    t.error(err)
  })
})

test('onRoute hook should pass correct route', t => {
  t.plan(7)
  const fastify = Fastify()
  fastify.addHook('onRoute', (route) => {
    t.strictEqual(route.method, 'GET')
    t.strictEqual(route.url, '/')
    t.strictEqual(route.path, '/')
  })

  fastify.register((instance, opts, next) => {
    instance.addHook('onRoute', (route) => {
      t.strictEqual(route.method, 'GET')
      t.strictEqual(route.url, '/')
      t.strictEqual(route.path, '/')
    })
    instance.get('/', opts, function (req, reply) {
      reply.send()
    })
    next()
  })

  fastify.ready(err => {
    t.error(err)
  })
})

test('onRoute hook should pass correct route with custom prefix', t => {
  t.plan(9)
  const fastify = Fastify()
  fastify.addHook('onRoute', function (route) {
    t.strictEqual(route.method, 'GET')
    t.strictEqual(route.url, '/v1/foo')
    t.strictEqual(route.path, '/v1/foo')
    t.strictEqual(route.prefix, '/v1')
  })

  fastify.register((instance, opts, next) => {
    instance.addHook('onRoute', function (route) {
      t.strictEqual(route.method, 'GET')
      t.strictEqual(route.url, '/v1/foo')
      t.strictEqual(route.path, '/v1/foo')
      t.strictEqual(route.prefix, '/v1')
    })
    instance.get('/foo', opts, function (req, reply) {
      reply.send()
    })
    next()
  }, { prefix: '/v1' })

  fastify.ready(err => {
    t.error(err)
  })
})

test('onRoute hook should pass correct route with custom options', t => {
  t.plan(5)
  const fastify = Fastify()
  fastify.register((instance, opts, next) => {
    instance.addHook('onRoute', function (route) {
      t.strictEqual(route.method, 'GET')
      t.strictEqual(route.url, '/foo')
      t.strictEqual(route.logLevel, 'info')
      t.strictEqual(route.jsonBodyLimit, 100)
    })
    instance.get('/foo', { logLevel: 'info', jsonBodyLimit: 100 }, function (req, reply) {
      reply.send()
    })
    next()
  })

  fastify.ready(err => {
    t.error(err)
  })
})

test('onRoute hook should receive any route option', t => {
  t.plan(4)
  const fastify = Fastify()
  fastify.register((instance, opts, next) => {
    instance.addHook('onRoute', function (route) {
      t.strictEqual(route.method, 'GET')
      t.strictEqual(route.url, '/foo')
      t.strictEqual(route.auth, 'basic')
    })
    instance.get('/foo', { auth: 'basic' }, function (req, reply) {
      reply.send()
    })
    next()
  })

  fastify.ready(err => {
    t.error(err)
  })
})

test('onRoute hook should preserve system route configuration', t => {
  t.plan(4)
  const fastify = Fastify()
  fastify.register((instance, opts, next) => {
    instance.addHook('onRoute', function (route) {
      t.strictEqual(route.method, 'GET')
      t.strictEqual(route.url, '/foo')
      t.strictEqual(route.handler.length, 2)
    })
    instance.get('/foo', { url: '/bar', method: 'POST', handler: () => {} }, function (req, reply) {
      reply.send()
    })
    next()
  })

  fastify.ready(err => {
    t.error(err)
  })
})

test('onResponse hook should support encapsulation / 1', t => {
  t.plan(3)
  const fastify = Fastify()

  fastify.register((instance, opts, next) => {
    instance.addHook('onResponse', () => {})
    t.is(instance._hooks.onResponse.length, 1)
    next()
  })

  fastify.ready(err => {
    t.error(err)
    t.is(fastify._hooks.onResponse.length, 0)
  })
})

test('onResponse hook should support encapsulation / 2', t => {
  t.plan(3)
  const fastify = Fastify()

  fastify.addHook('onResponse', () => {})

  fastify.register((instance, opts, next) => {
    instance.addHook('onResponse', () => {})
    t.is(instance._hooks.onResponse.length, 2)
    next()
  })

  fastify.ready(err => {
    t.error(err)
    t.is(fastify._hooks.onResponse.length, 1)
  })
})

test('onResponse hook should support encapsulation / 3', t => {
  t.plan(16)
  const fastify = Fastify()
  fastify.decorate('hello', 'world')

  fastify.addHook('onResponse', function (res, next) {
    t.ok(this.hello)
    t.ok('onResponse called')
    next()
  })

  fastify.get('/first', (req, reply) => {
    reply.send({ hello: 'world' })
  })

  fastify.register((instance, opts, next) => {
    instance.decorate('hello2', 'world')
    instance.addHook('onResponse', function (res, next) {
      t.ok(this.hello)
      t.ok(this.hello2)
      t.ok('onResponse called')
      next()
    })

    instance.get('/second', (req, reply) => {
      reply.send({ hello: 'world' })
    })

    next()
  })

  fastify.listen(0, err => {
    t.error(err)
    fastify.server.unref()

    sget({
      method: 'GET',
      url: 'http://localhost:' + fastify.server.address().port + '/first'
    }, (err, response, body) => {
      t.error(err)
      t.strictEqual(response.statusCode, 200)
      t.strictEqual(response.headers['content-length'], '' + body.length)
      t.deepEqual(JSON.parse(body), { hello: 'world' })
    })

    sget({
      method: 'GET',
      url: 'http://localhost:' + fastify.server.address().port + '/second'
    }, (err, response, body) => {
      t.error(err)
      t.strictEqual(response.statusCode, 200)
      t.strictEqual(response.headers['content-length'], '' + body.length)
      t.deepEqual(JSON.parse(body), { hello: 'world' })
    })
  })
})

test('onSend hook should support encapsulation / 1', t => {
  t.plan(3)
  const fastify = Fastify()

  fastify.addHook('onSend', () => {})

  fastify.register((instance, opts, next) => {
    instance.addHook('onSend', () => {})
    t.is(instance._hooks.onSend.length, 2)
    next()
  })

  fastify.ready(err => {
    t.error(err)
    t.is(fastify._hooks.onSend.length, 1)
  })
})

test('onSend hook should support encapsulation / 2', t => {
  t.plan(16)
  const fastify = Fastify()
  fastify.decorate('hello', 'world')

  fastify.addHook('onSend', function (request, reply, thePayload, next) {
    t.ok(this.hello)
    t.ok('onSend called')
    next()
  })

  fastify.get('/first', (req, reply) => {
    reply.send({ hello: 'world' })
  })

  fastify.register((instance, opts, next) => {
    instance.decorate('hello2', 'world')
    instance.addHook('onSend', function (request, reply, thePayload, next) {
      t.ok(this.hello)
      t.ok(this.hello2)
      t.ok('onSend called')
      next()
    })

    instance.get('/second', (req, reply) => {
      reply.send({ hello: 'world' })
    })

    next()
  })

  fastify.listen(0, err => {
    t.error(err)
    fastify.server.unref()

    sget({
      method: 'GET',
      url: 'http://localhost:' + fastify.server.address().port + '/first'
    }, (err, response, body) => {
      t.error(err)
      t.strictEqual(response.statusCode, 200)
      t.strictEqual(response.headers['content-length'], '' + body.length)
      t.deepEqual(JSON.parse(body), { hello: 'world' })
    })

    sget({
      method: 'GET',
      url: 'http://localhost:' + fastify.server.address().port + '/second'
    }, (err, response, body) => {
      t.error(err)
      t.strictEqual(response.statusCode, 200)
      t.strictEqual(response.headers['content-length'], '' + body.length)
      t.deepEqual(JSON.parse(body), { hello: 'world' })
    })
  })
})

test('modify payload', t => {
  t.plan(10)
  const fastify = Fastify()
  const payload = { hello: 'world' }
  const modifiedPayload = { hello: 'modified' }
  const anotherPayload = { winter: 'is coming' }

  fastify.addHook('onSend', function (request, reply, thePayload, next) {
    t.ok('onSend called')
    t.deepEqual(thePayload, payload)
    // onSend allows only to modify Object keys and not the full object's reference
    thePayload.hello = 'modified'
    next(null, thePayload)
  })

  fastify.addHook('onSend', function (request, reply, thePayload, next) {
    t.ok('onSend called')
    t.deepEqual(thePayload, modifiedPayload)
    next(null, anotherPayload)
  })

  fastify.addHook('onSend', function (request, reply, thePayload, next) {
    t.ok('onSend called')
    t.deepEqual(thePayload, anotherPayload)
    next()
  })

  fastify.get('/', (req, reply) => {
    reply.send(payload)
  })

  fastify.inject({
    method: 'GET',
    url: '/'
  }, (err, res) => {
    t.error(err)
    t.deepEqual(anotherPayload, JSON.parse(res.payload))
    t.strictEqual(res.statusCode, 200)
    t.strictEqual(res.headers['content-length'], '22')
  })
})

test('onSend hook throws', t => {
  t.plan(7)
  const fastify = Fastify()
  fastify.addHook('onSend', function (request, reply, payload, next) {
    if (request.raw.method === 'DELETE') {
      next(new Error('some error'))
      return
    }
    next()
  })

  fastify.get('/', (req, reply) => {
    reply.send({hello: 'world'})
  })

  fastify.delete('/', (req, reply) => {
    reply.send({hello: 'world'})
  })

  fastify.listen(0, err => {
    t.error(err)
    fastify.server.unref()
    sget({
      method: 'GET',
      url: 'http://localhost:' + fastify.server.address().port
    }, (err, response, body) => {
      t.error(err)
      t.strictEqual(response.statusCode, 200)
      t.strictEqual(response.headers['content-length'], '' + body.length)
      t.deepEqual(JSON.parse(body), { hello: 'world' })
    })
    sget({
      method: 'DELETE',
      url: 'http://localhost:' + fastify.server.address().port
    }, (err, response, body) => {
      t.error(err)
      t.strictEqual(response.statusCode, 500)
    })
  })
})

test('onSend hook should receive valid request and reply objects if onRequest hook fails', t => {
  t.plan(4)
  const fastify = Fastify()

  fastify.decorateRequest('testDecorator', 'testDecoratorVal')
  fastify.decorateReply('testDecorator', 'testDecoratorVal')

  fastify.addHook('onRequest', function (req, res, next) {
    next(new Error('onRequest hook failed'))
  })

  fastify.addHook('onSend', function (request, reply, payload, next) {
    t.strictEqual(request.testDecorator, 'testDecoratorVal')
    t.strictEqual(reply.testDecorator, 'testDecoratorVal')
    next()
  })

  fastify.get('/', (req, reply) => {
    reply.send('hello')
  })

  fastify.inject({
    method: 'GET',
    url: '/'
  }, (err, res) => {
    t.error(err)
    t.strictEqual(res.statusCode, 500)
  })
})

test('onSend hook should receive valid request and reply objects if middleware fails', t => {
  t.plan(4)
  const fastify = Fastify()

  fastify.decorateRequest('testDecorator', 'testDecoratorVal')
  fastify.decorateReply('testDecorator', 'testDecoratorVal')

  fastify.use(function (req, res, next) {
    next(new Error('middlware failed'))
  })

  fastify.addHook('onSend', function (request, reply, payload, next) {
    t.strictEqual(request.testDecorator, 'testDecoratorVal')
    t.strictEqual(reply.testDecorator, 'testDecoratorVal')
    next()
  })

  fastify.get('/', (req, reply) => {
    reply.send('hello')
  })

  fastify.inject({
    method: 'GET',
    url: '/'
  }, (err, res) => {
    t.error(err)
    t.strictEqual(res.statusCode, 500)
  })
})

test('onSend hook should receive valid request and reply objects if a custom content type parser fails', t => {
  t.plan(4)
  const fastify = Fastify()

  fastify.decorateRequest('testDecorator', 'testDecoratorVal')
  fastify.decorateReply('testDecorator', 'testDecoratorVal')

  fastify.addContentTypeParser('*', function (req, done) {
    done(new Error('content type parser failed'))
  })

  fastify.addHook('onSend', function (request, reply, payload, next) {
    t.strictEqual(request.testDecorator, 'testDecoratorVal')
    t.strictEqual(reply.testDecorator, 'testDecoratorVal')
    next()
  })

  fastify.get('/', (req, reply) => {
    reply.send('hello')
  })

  fastify.inject({
    method: 'POST',
    url: '/',
    payload: 'body'
  }, (err, res) => {
    t.error(err)
    t.strictEqual(res.statusCode, 500)
  })
})

if (Number(process.versions.node[0]) >= 8) {
  require('./hooks-async')(t)
} else {
  t.pass('Skip because Node version < 8')
  t.end()
}
