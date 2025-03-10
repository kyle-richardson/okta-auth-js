/*!
 * Copyright (c) 2015-present, Okta, Inc. and/or its affiliates. All rights reserved.
 * The Okta software accompanied by this notice is provided pursuant to the Apache License, Version 2.0 (the "License.")
 *
 * You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0.
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
 * WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * 
 * See the License for the specific language governing permissions and limitations under the License.
 */


/* global window, document */

import { OktaAuth } from '@okta/okta-auth-js';
import util from '@okta/test.support/util';
import packageJson from '../../package.json';

describe('fingerprint', function() {
  var test;
  beforeEach(function() {
    test = {};
  });
  afterEach(function() {
    jest.useRealTimers();
  });

  function setup(options) {
    options = options || {};
    var listeners = {};
    var postMessageSpy = jest.spyOn(window, 'postMessage').mockImplementation(function(msg, url) {
      // "receive" the message in the iframe
      expect(url).toEqual('http://example.okta.com');
      expect(msg).toEqual(expect.any(String));
      expect(JSON.parse(msg).type).toEqual('GetFingerprint');
      expect(listeners.message).toEqual(expect.any(Function));
      listeners.message({
        data: JSON.stringify({
          type: 'FingerprintAvailable',
          fingerprint: 'ABCD'
        }),
        origin: 'http://example.okta.com'
      });
    });

    test.iframe = {
      style: {},
      parentElement: {
        removeChild: jest.fn()
      }
    };

    jest.spyOn(window, 'addEventListener').mockImplementation(function(name, fn) {
      if (name === 'message') {
        listeners.message = fn;
      }
    });
    jest.spyOn(document, 'createElement').mockReturnValue(test.iframe);
    jest.spyOn(document.body, 'contains').mockReturnValue(true);
    jest.spyOn(document.body, 'appendChild').mockImplementation(function() {
      if (options.timeout) { return; }
      // mimic async page load with setTimeouts
      if (options.sendOtherMessage) {
        setTimeout(function() {
          listeners.message({
            data: '{"not":"forUs"}',
            origin: 'http://not.okta.com'
          });
        });
      }
      setTimeout(function() {
        listeners.message({
          data: options.firstMessage || JSON.stringify({
            type: 'FingerprintServiceReady'
          }),
          origin: 'http://example.okta.com',
          source: {
            postMessage: postMessageSpy
          }
        });
      });
    });

    var authClient = options.authClient || new OktaAuth({
      pkce: false,
      issuer: 'http://example.okta.com'
    });
    if (typeof options.userAgent !== 'undefined') {
      util.mockUserAgent(authClient, options.userAgent);
    }
    return authClient;
  }

  it('iframe is created with the right src and it is hidden', function () {
    jest.useFakeTimers();
    var promise =  setup().fingerprint();
    return Promise.resolve()
      .then(function() {
        jest.runAllTicks(); // resolves outstanding promises
        jest.advanceTimersByTime(1); // allow listener to be called
        return promise;
      })
      .then(function(fingerprint) {
        expect(document.createElement).toHaveBeenCalled();
        expect(test.iframe.style.display).toEqual('none');
        expect(test.iframe.src).toEqual('http://example.okta.com/auth/services/devicefingerprint');
        expect(document.body.appendChild).toHaveBeenCalledWith(test.iframe);
        expect(window.postMessage).toHaveBeenCalled();
        expect(test.iframe.parentElement.removeChild).toHaveBeenCalled();
        expect(fingerprint).toEqual('ABCD');
      });
  });

  it('allows non-Okta postMessages', function () {
    return setup({ sendOtherMessage: true }).fingerprint()
    .catch(function(err) {
      expect(err).toBeUndefined();
    })
    .then(function(fingerprint) {
      expect(fingerprint).toEqual('ABCD');
    });
  });

  it('fails if user agent is not defined', function () {
    return setup({ userAgent: '' }).fingerprint()
    .then(function() {
      throw new Error('Fingerprint promise should have been rejected');
    })
    .catch(function(err) {
      util.assertAuthSdkError(err, 'Fingerprinting is not supported on this device');
    });
  });

  it('fails if it is called from a Windows phone', function () {
    return setup({
      userAgent: 'Mozilla/5.0 (compatible; MSIE 9.0; Windows Phone OS 7.5; Trident/5.0;)'
    }).fingerprint()
    .then(function() {
      throw new Error('Fingerprint promise should have been rejected');
    })
    .catch(function(err) {
      util.assertAuthSdkError(err, 'Fingerprinting is not supported on this device');
    });
  });

  it('fails after a timeout period', function () {
    return setup({ timeout: true }).fingerprint({ timeout: 5 })
    .then(function() {
      throw new Error('Fingerprint promise should have been rejected');
    })
    .catch(function(err) {
      util.assertAuthSdkError(err, 'Fingerprinting timed out');
    });
  });

  util.itMakesCorrectRequestResponse({
    title: 'attaches fingerprint to signIn requests if sendFingerprint is true',
    setup: {
      issuer: 'http://example.okta.com',
      calls: [
        {
          request: {
            method: 'post',
            uri: '/api/v1/authn',
            data: { username: 'not', password: 'real' },
            headers: {
              'Accept': 'application/json',
              'Content-Type': 'application/json',
              'X-Device-Fingerprint': 'ABCD'
            }
          },
          response: 'success'
        }
      ]
    },
    execute: function (test) {
      return setup({ authClient: test.oa }).signIn({
        username: 'not',
        password: 'real',
        sendFingerprint: true
      });
    }
  });

  util.itMakesCorrectRequestResponse({
    title: 'does not attach fingerprint to signIn requests if sendFingerprint is false',
    setup: {
      issuer: 'http://example.okta.com',
      calls: [
        {
          request: {
            method: 'post',
            uri: '/api/v1/authn',
            data: { username: 'not', password: 'real' },
            headers: {
              'Accept': 'application/json',
              'Content-Type': 'application/json',
            }
          },
          response: 'success'
        }
      ]
    },
    execute: function (test) {
      return test.oa.signIn({
        username: 'not',
        password: 'real',
        sendFingerprint: false
      });
    }
  });
});
