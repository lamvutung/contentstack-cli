@contentstack/cli-auth
===

It is Contentstack’s CLI plugin to perform authentication-related activities. To get started with authenticating yourself with the CLI, refer to the [CLI’s Authentication documentation](https://www.contentstack.com/docs/developers/cli/authentication)

[![License](https://img.shields.io/npm/l/@contentstack/cli)](https://github.com/contentstack/cli/blob/main/LICENSE)

<!-- toc -->
* [Usage](#usage)
* [Commands](#commands)
<!-- tocstop -->
# Usage
<!-- usage -->
```sh-session
$ npm install -g @contentstack/cli-command-test
$ csdx COMMAND
running command...
$ csdx (-v|--version|version)
@contentstack/cli-command-test/0.1.1-beta.1 linux-x64 node-v12.22.1
$ csdx --help [COMMAND]
USAGE
  $ csdx COMMAND
...
```
<!-- usagestop -->
# Commands
<!-- commands -->
* [`csdx config:get:region`](#csdx-configgetregion)
* [`csdx config:set:region`](#csdx-configsetregion)

## `csdx config:get:region`

Set region for CLI

```
USAGE
  $ csdx config:get:region

EXAMPLE
  $ csdx config:get:region
```

_See code: [src/commands/config/get/region.ts](https://github.com/contentstack/cli/blob/v0.1.1-beta.1/src/commands/config/get/region.ts)_

## `csdx config:set:region`

Set region for CLI

```
USAGE
  $ csdx config:set:region

OPTIONS
  -d, --cda=cda    Custom host to set for content delivery API, if this flag is added then cma and name flags are
                   required

  -m, --cma=cma    Custom host to set for content management API, , if this flag is added then cda and name flags are
                   required

  -n, --name=name  Name for the region, if this flag is added then cda and cma flags are required

EXAMPLES
  $ csdx config:set:region EU
  $ csdx config:set:region --cma <contentstack_cma_endpoint> --cda <contentstack_cda_endpoint> --name "India"
  $ csdx config:set:region --cma="https://in-api.contentstack.com" --cda="https://in-cda.contentstack.com" 
  --name="India"
```

_See code: [src/commands/config/set/region.ts](https://github.com/contentstack/cli/blob/v0.1.1-beta.1/src/commands/config/set/region.ts)_
<!-- commandsstop -->
