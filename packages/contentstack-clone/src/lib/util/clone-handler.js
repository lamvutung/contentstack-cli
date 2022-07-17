const ora = require('ora');
const path = require('path');
const inquirer = require('inquirer');
const rimraf = require('rimraf');
const chalk = require('chalk');

let sdkInstance = require('../../lib/util/contentstack-management-sdk');
let exportCmd = require('@contentstack/cli-cm-export');
let importCmd = require('@contentstack/cli-cm-import');

const { 
  HandleOrgCommand, HandleStackCommand, HandleDestinationStackCommand, HandleExportCommand,
  SetBranchCommand, CreateNewStackCommand, CloneTypeSelectionCommand, Clone,
} = require('../helpers/command-helpers');

let client = {};
let config;
let cloneCommand;

let stackCreationConfirmation = [
  {
    type: 'confirm',
    name: 'stackCreate',
    message: 'Want to clone content into a new stack ?',
    initial: true,
  },
];

let stackName = {
  type: 'input',
  name: 'stack',
  default: 'ABC',
  message: 'Enter name for the new stack to store the cloned content ?',
};

let orgUidList = {};
let stackUidList = {};
let masterLocaleList = {};

let structureList = [
  'locales',
  'environments',
  'extensions',
  'webhooks',
  'global-fields',
  'content-types',
  'workflows',
  'labels',
];
let master_locale;

class CloneHandler {
  constructor(opt) {
    config = opt;
    client = sdkInstance.Client(config);
    cloneCommand = new Clone();
    process.stdin.setMaxListeners(50);
  }

  handleOrgSelection(options = {}) {
    return new Promise(async (resolve, reject) => {
      const { msg = '', isSource = true } = options || {};
      const orgList = await this.getOrganizationChoices(msg).catch(reject);

      if (orgList) {
        const orgSelected = await inquirer.prompt(orgList);

        if (isSource) {
          config.sourceOrg = orgUidList[orgSelected.Organization];
        } else {
          config.targetOrg = orgUidList[orgSelected.Organization];
        }

        resolve(orgSelected);
      }
    });
  }

  handleStackSelection(options = {}) {
    let keyPressHandler;
    return new Promise(async (resolve, reject) => {
      try {
        const { org = {}, msg = '', isSource = true, stackAbortController } = options || {}
  
        keyPressHandler = async function (ch, key) {
          if (key.name === 'backspace') {
            stackAbortController.abort();
            console.clear();
            process.stdin.removeListener('keypress', keyPressHandler);
            await cloneCommand.undo();
          }
        };
        process.stdin.addListener('keypress', keyPressHandler);
  
        const stackList = await this.getStack(org, msg, isSource).catch(reject)
  
        if (stackList) {
          const ui = new inquirer.ui.BottomBar();
          // Use chalk to prettify the text.
          ui.updateBottomBar(chalk.blue('For undo operation press backspace\n'));
  
          const selectedStack = await inquirer.prompt(stackList);
          
          if (stackAbortController.signal.aborted) {
            return reject();
          }
          if (isSource) {
            config.sourceStackName = selectedStack.stack;
            master_locale = masterLocaleList[selectedStack.stack];
            config.source_stack = stackUidList[selectedStack.stack];
          } else {
            config.target_stack = stackUidList[selectedStack.stack];
            config.destinationStackName = selectedStack.stack;
          }
  
          resolve(selectedStack)
        }
      } catch (error) {
        return reject(error);
      } finally {
        if (keyPressHandler) {
          process.stdin.removeListener('keypress', keyPressHandler);
        }
      }
    });
  }

  execute(pathDir) {
    return new Promise(async (resolve, reject) => {
      let stackAbortController;
      try {
        if (!config.source_stack) {
          const orgMsg = 'Choose an organization where your source stack exists:';
          const stackMsg = 'Select the source stack';

          stackAbortController = new AbortController();

          const org = await cloneCommand.execute(new HandleOrgCommand({ msg: orgMsg, isSource: true }, this));
          if (org) {
            const sourceStack = await cloneCommand.execute(new HandleStackCommand({ org, isSource: true, msg: stackMsg, stackAbortController }, this));
            if (stackAbortController.signal.aborted) {
              return reject();
            }
            stackName.default = config.stackName || `Copy of ${sourceStack.stack || config.source_alias}`;
          } else {
            return reject('Org not found.');
          }
        }
        const exportRes = await cloneCommand.execute(new HandleExportCommand(null, this));
        await cloneCommand.execute(new SetBranchCommand(null, this));

        if (exportRes) {
          this.executeDestination(pathDir).catch(() => reject());
        }
        return resolve();
      } catch (error) {
        return reject(error);
      } finally {
        if (stackAbortController) {
          stackAbortController.abort();
        }
      }
    });
  }

  async executeDestination(pathDir) {
    return new Promise(async (resolve, reject) => {
      let stackAbortController;
      try {
        stackAbortController = new AbortController();

        let canCreateStack = false;

        if (!config.target_stack) {
          canCreateStack = await inquirer.prompt(stackCreationConfirmation);
        }

        if (!canCreateStack.stackCreate) {
          if (!config.target_stack) {
            const orgMsg = 'Choose an organization where the destination stack exists: ';
            const org = await cloneCommand.execute(new HandleOrgCommand({ msg: orgMsg }, this));
            if (org) {
              const stackMsg = 'Choose the destination stack:';
              await cloneCommand.execute(new HandleDestinationStackCommand({ org, msg: stackMsg, stackAbortController }, this));
            }
          }
        } else {
          const destinationOrg = await this.handleOrgSelection({ isSource: false, msg: 'Choose an organization where you want to create a stack: ' });
          const orgUid = orgUidList[destinationOrg.Organization];
          await cloneCommand.execute(new CreateNewStackCommand(orgUid, this));
        }
        await cloneCommand.execute(new CloneTypeSelectionCommand(null, this));
        return resolve();
      } catch (error) {
        reject(error);
      } finally {
        // If not aborted and ran successfully
        if (!stackAbortController.signal.aborted) {
          // Call clean dir.
          rimraf(pathDir, function () {
            // eslint-disable-next-line no-console
            console.log('Stack cloning process have been completed successfully');
          });
        }
      }
    });
  }

  async setBranch() {
    if (!config.sourceStackBranch) {
      try {
        const branches = await client.stack({ api_key: config.source_stack }).branch().query().find();

        if (branches && branches.items && branches.items.length) {
          config.sourceStackBranch = 'main';
        }
      } catch (_error) { }
    }
  }

  async getOrganizationChoices (orgMessage) {
    let orgChoice = {
      type: 'list',
      name: 'Organization',
      message: orgMessage !== undefined ? orgMessage : 'Choose an organization',
      choices: [],
    };
    return new Promise(async (resolve, reject) => {
      const spinner = ora('Fetching Organization').start();
      try {
        let organizations = await client.organization().fetchAll({ limit: 100 });
        spinner.succeed('Fetched Organization');
        for (let i = 0; i < organizations.items.length; i++) {
          orgUidList[organizations.items[i].name] = organizations.items[i].uid;
          orgChoice.choices.push(organizations.items[i].name);
        }
        return resolve(orgChoice);
      } catch (e) {
        spinner.fail();
        return reject(e);
      }
    });
  };

  async getStack (answer, stkMessage) {
    return new Promise(async (resolve, reject) => {
      let stackChoice = {
        type: 'list',
        name: 'stack',
        message: stkMessage !== undefined ? stkMessage : 'Select the stack',
        choices: [],
      };
      const spinner = ora('Fetching stacks').start();
      try {
        const organization_uid = orgUidList[answer.Organization];
        const stackList = client.stack().query({ organization_uid }).find();
        stackList
          .then((stacklist) => {
            for (let j = 0; j < stacklist.items.length; j++) {
              stackUidList[stacklist.items[j].name] = stacklist.items[j].api_key;
              masterLocaleList[stacklist.items[j].name] = stacklist.items[j].master_locale;
              stackChoice.choices.push(stacklist.items[j].name);
            }
            spinner.succeed('Fetched stack');
            return resolve(stackChoice);
          })
          .catch((error) => {
            spinner.fail();
            return reject(error);
          });
      } catch (e) {
        spinner.fail();
        return reject(e);
      }
    });
  };

  async createNewStack(orgUid) {
    return new Promise(async (resolve, reject) => {
      let inputvalue;

      if (!config.stackName) {
        inputvalue = await inquirer.prompt(stackName);
      } else {
        inputvalue = { stack: config.stackName };
      }

      let stack = { name: inputvalue.stack, master_locale: master_locale };
      const spinner = ora('Creating New stack').start();
      let newStack = client.stack().create({ stack }, { organization_uid: orgUid });
      newStack
        .then((result) => {
          spinner.succeed('New Stack created Successfully name as ' + result.name);
          config.target_stack = result.api_key;
          config.destinationStackName = result.name;
          return resolve(result);
        })
        .catch((error) => {
          spinner.fail();
          return reject(error.errorMessage + ' Contact the Organization owner for Stack Creation access.');
        });
    });
  }

  async cloneTypeSelection() {
    return new Promise(async (resolve, reject) => {
      const choices = [
        'Structure (all modules except entries & assets)',
        'Structure with content (all modules including entries & assets)',
      ];
      const cloneTypeSelection = [
        {
          choices,
          type: 'list',
          name: 'type',
          message: 'Choose the type of data to clone:',
        },
      ];
      let successMsg;
      let selectedValue = {};
      config['data'] = path.join(__dirname.split('src')[0], 'contents', config.sourceStackBranch || '');

      if (!config.cloneType) {
        selectedValue = await inquirer.prompt(cloneTypeSelection);
      }

      if (config.cloneType === 'a' || selectedValue.type === 'Structure (all modules except entries & assets)') {
        config['modules'] = structureList;
        successMsg = 'Stack clone Structure completed';
      } else {
        successMsg = 'Stack clone completed with structure and content';
      }

      this.cmdImport()
        .then(() => resolve(successMsg))
        .catch(reject);
    });
  }

  async cmdExport() {
    return new Promise((resolve, reject) => {
      const cmd = ['-k', config.source_stack, '-d', __dirname.split('src')[0] + 'contents'];

      if (config.source_alias) {
        cmd.push('-a', config.source_alias);
      }
      if (config.sourceStackBranch) {
        cmd.push('--branch', config.sourceStackBranch);
      }

      let exportData = exportCmd.run(cmd);
      exportData.then(() => resolve(true)).catch(reject);
    });
  }

  async cmdImport() {
    return new Promise(async (resolve, _reject) => {
      const cmd = ['-c', path.join(__dirname, 'dummyConfig.json')];

      if (config.destination_alias) {
        cmd.push('-a', config.destination_alias);
      }
      if (config.sourceStackBranch) {
        cmd.push('-d', path.join(__dirname, config.sourceStackBranch));
      }
      if (config.targetStackBranch) {
        cmd.push('--branch', config.targetStackBranch);
      }
      if (config.importWebhookStatus) {
        cmd.push('--import-webhook-status', config.importWebhookStatus);
      }

      await importCmd.run(cmd);
      return resolve();
    });
  }
}

module.exports = {
  CloneHandler,
  client,
};
