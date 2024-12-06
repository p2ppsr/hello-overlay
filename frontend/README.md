# HelloWorld Example Overlay App

Broadcast and track HelloWorld messages using Bitcoin.

A Stageline ("testnet") deployment of the master branch of this repository is at staging-helloworld.babbage.systems

## Overview

This HelloWorld example application showcases MetaNet technologies like tokenization, identity, and state management.

You also need to understand the HelloWorld Protocol, which defines the data format for HelloWorld tokens.

To learn more about building Bitcoin-powered applications for the MetaNet with these tools, head over to the Babbage Platform Documentation.

## Development Instructions

Clone the repo, then run npm i to install packages.

To start the live development server on localhost:8088, run npm run start.

Start Babbage Stageline to interact with this application.

Your changes should be reflected on-screen whenever you save in your editor, or reload.

## HelloWorld Protocol Document

You can find the HelloWorld Protocol in PROTOCOL.md

## Tools Used

This HelloWorld application uses various Bitcoin and web-related tools for different things:

- React We use React to render the webpage UI for this application, and track the state of the page.
- MUI We use a UI framework within React called MUI to help with page styling, text fields, buttons, and dialog boxes.
- Bitcoin SV We use the Bitcoin SV blockchain to timestamp and register our HelloWorld message tokens, and we rely on satoshis (a measurement of Bitcoin), so that the HelloWorld tokens are valuable.
- Babbage SDK We use the Babbage SDK so that users are able to have a Bitcoin-native identity, and can create and track Bitcoin tokens. The SDK also allows us to easily encrypt message data for added user privacy.
- PushDrop We use PushDrop to create Bitcoin tokens that follow the HelloWorld protocol. - PushDrop makes it easier to add data payloads to tokens, while still being able to give them value.

## License

The license for the code in this repository is the Open BSV License.