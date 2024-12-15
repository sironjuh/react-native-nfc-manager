jest.mock('../src/NativeNfcManager');

import {Platform} from 'react-native';
import {
  NativeNfcManager,
  NfcManagerEmitter,
  callNative,
} from '../src/NativeNfcManager';
import * as NfcError from '../src/NfcError';

describe('NfcManager (ios)', () => {
  Platform.setOS('ios');
  const NfcManagerModule = require('../src/index.js');
  const NfcManager = NfcManagerModule.default;
  const {NfcEvents, NfcErrorIOS, NfcTech} = NfcManagerModule;
  const lastNativeCall = () =>
    callNative.mock.calls[callNative.mock.calls.length - 1];

  test('constructor', () => {
    expect(Platform.OS).toBe('ios');
    // the NfcManager instance doest exist
    expect(!!NfcManager).toEqual(true);
  });

  test('register native events', () => {
    for (const evtName of [NfcEvents.DiscoverTag, NfcEvents.SessionClosed]) {
      let hit = false;
      for (const mockCall of NfcManagerEmitter.addListener.mock.calls) {
        if (mockCall[0] === evtName) {
          hit = true;
          break;
        }
      }

      if (!hit) {
        // this native event is not registered, treat as error
        expect(true).toBe(false);
      }
    }
  });

  test('API capability', () => {
    expect(typeof NfcManager.start).toBe('function');
    expect(typeof NfcManager.isSupported).toBe('function');
    expect(typeof NfcManager.setEventListener).toBe('function');
    expect(typeof NfcManager.registerTagEvent).toBe('function');
    expect(typeof NfcManager.unregisterTagEvent).toBe('function');
    expect(typeof NfcManager.getTag).toBe('function');
    expect(typeof NfcManager.requestTechnology).toBe('function');
    expect(typeof NfcManager.cancelTechnologyRequest).toBe('function');
  });

  test('API: start', () => {
    NfcManager.start();
    expect(lastNativeCall()[0]).toEqual('start');
  });

  test('API: isSupported', () => {
    NfcManager.isSupported('Ndef');
    expect(lastNativeCall()[0]).toEqual('isSupported');
    expect(lastNativeCall()[1]).toEqual(['Ndef']);
  });

  test('API: setEventListener', () => {
    try {
      NfcManager.setEventListener('no-such-event', () => 0);
      expect(false).toBe(true);
    } catch (ex) {
      // should throw an ex if no such event
      expect(true).toBe(true);
    }

    // can receive DiscoverTag event
    const tag1 = {id: '3939889'};
    let tag2 = null;
    NfcManager.setEventListener(NfcEvents.DiscoverTag, (tag) => {
      tag2 = tag;
    });
    NfcManagerEmitter._testTriggerCallback(NfcEvents.DiscoverTag, tag1);
    expect(tag2).toEqual(tag1);

    // can receive SessionClosed event
    let sessionClosed = false;
    NfcManager.setEventListener(NfcEvents.SessionClosed, () => {
      sessionClosed = true;
    });
    NfcManagerEmitter._testTriggerCallback(NfcEvents.SessionClosed, {
      error: 'NFCError:200',
    });
    expect(sessionClosed).toBe(true);
  });

  test('API: registerTagEvent', () => {
    NfcManager.registerTagEvent();
    expect(lastNativeCall()[0]).toEqual('registerTagEvent');
    const options = lastNativeCall()[1][0];
    // check if we pass the default options into native
    expect(options.alertMessage).toEqual('Please tap NFC tags');
    expect(options.invalidateAfterFirstRead).toBe(false);
  });

  test('API: cancelTechnologyRequest', async () => {
    // won't throw any error during cancellation by default
    NativeNfcManager.setNextError('fake-error');
    await NfcManager.cancelTechnologyRequest();

    NativeNfcManager.setNextError('fake-error-again');
    try {
      // default can be overriden by throwOnError
      await NfcManager.cancelTechnologyRequest({throwOnError: true});
    } catch (ex) {
      expect(ex.message).toEqual('fake-error-again');
    }
  });

  test('API: setAlertMessage', () => {
    NfcManager.setAlertMessageIOS('hello');
    expect(lastNativeCall()[0]).toEqual('setAlertMessage');
    expect(lastNativeCall()[1]).toEqual(['hello']);

    NfcManager.setAlertMessage('hello');
    expect(lastNativeCall()[0]).toEqual('setAlertMessage');
    expect(lastNativeCall()[1]).toEqual(['hello']);
  });

  test('NfcErrorIOS', () => {
    expect(NfcErrorIOS.parse({})).toEqual(NfcErrorIOS.errCodes.unknown);
    expect(NfcErrorIOS.parse('nosucherror')).toEqual(
      NfcErrorIOS.errCodes.unknown,
    );
    expect(NfcErrorIOS.parse('NFCError:200')).toEqual(
      NfcErrorIOS.errCodes.userCancel,
    );
  });

  test('NfcError', async () => {
    try {
      NativeNfcManager.setNextError('NFCError:200');
      await NfcManager.requestTechnology(NfcTech.Ndef);
    } catch (ex) {
      if (!(ex instanceof NfcError.UserCancel)) {
        expect(true).toBe(false);
      }

      // for backward capatible
      if (NfcErrorIOS.parse(ex) !== NfcErrorIOS.errCodes.userCancel) {
        expect(true).toBe(false);
      }
    }
  });
});
