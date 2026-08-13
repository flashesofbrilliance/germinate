#!/usr/bin/env node
'use strict';
const { main } = require('../src/cli');
process.exit(main(process.argv.slice(2)));
