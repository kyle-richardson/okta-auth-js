const SDK_VERSION = (global as any).SDK_VERSION;
const NODE_VERSION = (global as any).NODE_VERSION;

import { OktaUserAgent } from '../../lib/http/OktaUserAgent';

const mocked = {
  isBrowser: jest.fn()
};
jest.mock('lib/features', () => {
  return {
    __esModule: true,
    isBrowser: () => mocked.isBrowser()
  };
});

describe('OktaUserAgent', () => {
  const context: any = {};

  beforeEach(() => {
    context.oktaUserAgent = new OktaUserAgent();
  });

  describe('browser env', () => {
    beforeEach(() => {
      mocked.isBrowser.mockReturnValue(true);
      context.expected = `okta-auth-js/${SDK_VERSION}`;
      context.oktaUserAgent = new OktaUserAgent();
    });
  });

  describe('node env', () => {
    beforeEach(() => {
      mocked.isBrowser.mockReturnValue(false);
      context.expected = `okta-auth-js/${SDK_VERSION} nodejs/${NODE_VERSION}`;
      context.oktaUserAgent = new OktaUserAgent();
    });
  });

  it('can get sdk version', () => {
    const { oktaUserAgent } = context;
    expect(oktaUserAgent.getVersion()).toBe(SDK_VERSION);
  });
});
