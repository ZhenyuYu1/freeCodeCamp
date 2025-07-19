module.exports = function (app) {
  console.log('DEBUGGG: HELLO.JS IS RUNNING!!');
  app.get('/api/hello', (req, res) => {
    res.send({ message: 'Hello, world!' });
  });
};
