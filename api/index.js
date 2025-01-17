require('dotenv').config();

const express = require('express');
const faker = require('faker');

const app = express();

const apm = require('elastic-apm-node').start({
  serviceName: 'NODE_API',
  apiKey: process.env.ELASTIC_API_TOKEN,
  serverUrl: process.env.APM_SERVER,
  environment: 'development',
  captureBody: 'all',
  captureHeaders: true,
  captureExceptions: true,
  captureErrorLogStackTraces: true,
});

app.use(express.json());

app.use((req, res, next) => {
  const t = apm.startTransaction(`${req.method} ${req.path}`, {
    startTime: Date.now().toString(),
  });

  const user = {
    email: faker.internet.email(),
    username: faker.internet.userName(),
    id: faker.datatype.uuid(),
  };

  req.user = user;
  t.addLabels(user, true);
  if (req.body) t.addLabels({ body: JSON.stringify(req.body) }, false);
  if (req.query) t.addLabels({ query: JSON.stringify(req.query) }, false);
  if (req.params) t.addLabels({ params: JSON.stringify(req.params) }, false);
  apm.setUserContext(user);

  apm.setCustomContext({
    userId: user.id,
    userAuth: true,
  });

  apm.registerMetric('any_metric', () => {
    return Math.random();
  });

  apm.setSpanOutcome('success');

  req.transaction = t;
  req.id = faker.datatype.uuid();
  next();
});

app.get('/error', (req, res) => {
  try {
    throw new Error('Something went wrong');
  } catch (err) {
    req.transaction.end(req.id);
    apm.captureError(err);
    return res.json({ error: err.message });
  }
});

app.get('/', (req, res) => {
  req.transaction.end(req.id);
  return res.json({ message: 'Hello World' });
});

app.get('/delay', (req, res) => {
  setTimeout(() => {
    req.transaction.end(req.id);
    return res.json({ message: 'Delay Route' });
  }, 3000);
});

app.post('/post', (req, res) => {
  req.transaction.end(req.id);
  return res.json({ message: 'Post Route' });
});

app.listen(8080, () => console.log('API runing!'));
