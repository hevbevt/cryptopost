// From https://github.com/coinexcom/coinex_exchange_api/wiki/012security_authorization
const assert = require('assert');
const request = require('superagent');
const crypto = require('crypto');
const querystring = require('querystring');
const { get } = require('lodash');

require('superagent-proxy')(request);

const baseUrl = 'https://api.coinex.com/v1';

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/39.0.2171.71 Safari/537.36';

const wrapResponseError = error => {
  if (!error.response) {
    throw error;
  }

  const { body } = error.response;

  if (!body) {
    const wrapped = Object.assign(
      new Error(
        `Coinex: ${error.response.status} ${
          error.response.text
        }. See response field of error.`
      ),
      {
        inner: error,
        response: error.response,
        stack: error.stack,
      }
    );

    throw wrapped;
  }

  const { code, message } = body;
  assert(code, `Code: ${code}`);

  const wrapped = Object.assign(
    new Error(`Coinex: ${code} ${message}. See coinex field of error.`),
    {
      response: error.response,
      stack: error.stack,
      coinex: body,
    }
  );

  throw wrapped;
};

const parseResponse = response => {
  const body = Object.keys(response.body).length
    ? response.body
    : JSON.parse(response.text);
  const { code, message } = body;

  if (code) {
    const wrapped = new Error(
      `Coinex: ${code} ${message}. See coinex field of error`
    );
    wrapped.coinex = body;
    throw wrapped;
  }

  return body.data;
};

const createCoinexClient = (apiKey, apiSecret) => {
  const coinexGet = async (path, fields = {}) => {
    assert(path, 'path is required');

    const tonce = Date.now().toString();
    const completeUrl = baseUrl + path;

    const body = {
      access_id: apiKey,
      tonce,
      ...fields,
    };

    const bodySorted = Object.keys(body)
      .slice()
      .sort()
      .reduce(
        (prev, key) => ({
          ...prev,
          [key]: body[key],
        }),
        {}
      );

    const bodyAsQueryString = querystring.stringify(bodySorted);

    const bodyAsQueryStringWithSecret =
      bodyAsQueryString + '&secret_key=' + apiSecret;

    const signature = crypto
      .createHash('md5')
      .update(bodyAsQueryStringWithSecret)
      .digest('hex')
      .toUpperCase();

    const separator = completeUrl.includes('?') ? '&' : '?';

    const requestPromise = request
      .get(completeUrl + separator + bodyAsQueryString)
      .set('authorization', signature)
      .set('User-Agent', USER_AGENT)
      .proxy(process.env.HTTP_PROXY);

    return requestPromise.then(parseResponse, wrapResponseError);
  };

  const coinexPost = async (path, fields = {}) => {
    assert(path, 'path is required');

    const tonce = Date.now().toString();
    const completeUrl = baseUrl + path;

    const body = {
      access_id: apiKey,
      tonce,
      ...fields,
    };

    const bodySorted = Object.keys(body)
      .slice()
      .sort()
      .reduce(
        (prev, key) => ({
          ...prev,
          [key]: body[key],
        }),
        {}
      );

    const bodyAsQueryString = querystring.stringify(bodySorted);

    const bodyAsQueryStringWithSecret =
      bodyAsQueryString + '&secret_key=' + apiSecret;

    const signature = crypto
      .createHash('md5')
      .update(bodyAsQueryStringWithSecret)
      .digest('hex')
      .toUpperCase();

    const requestPromise = request
      .post(completeUrl)
      .send(bodySorted)
      .set('authorization', signature)
      .set('User-Agent', USER_AGENT)
      .proxy(process.env.HTTP_PROXY);

    return requestPromise.then(parseResponse, wrapResponseError);
  };

  return { get: coinexGet, post: coinexPost };
};

module.exports = createCoinexClient;
