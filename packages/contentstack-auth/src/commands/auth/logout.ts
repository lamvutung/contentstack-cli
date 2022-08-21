import { Command, flags } from '@contentstack/cli-command';
import { logger, cliux, configHandler, printFlagDeprecation } from '@contentstack/cli-utilities';

import { authHandler } from '../../utils';

export default class LogoutCommand extends Command {
  static run; // to fix the test issue
  static description = 'User session logout';
  static examples = ['$ csdx auth:logout', '$ csdx auth:logout -y', '$ csdx auth:logout --yes'];

  static flags = {
    yes: flags.boolean({
      char: 'y',
      description: 'Force log out by skipping the confirmation',
      // multiple: false,
      required: false,
    }),
    force: flags.boolean({
      char: 'f',
      description: 'Force log out by skipping the confirmation',
      // multiple: false,
      required: false,
      hidden: true,
      parse: printFlagDeprecation(['-f', '--force'], ['-y', '--yes']),
    }),
  };

  static aliases = ['logout'];

  async run(): Promise<any> {
    const { flags: logoutFlags } = this.parse(LogoutCommand);
    authHandler.client = this.managementAPIClient;
    let confirm = false;
    confirm =
      logoutFlags.force || logoutFlags.yes
        ? true
        : await cliux.inquire({
            type: 'confirm',
            message: 'CLI_AUTH_LOGOUT_CONFIRM',
            name: 'confirmation',
          });
    try {
      if (this.authToken) {
        if (confirm) {
          cliux.loader('CLI_AUTH_LOGOUT_LOADER_START');
          const authtoken = this.authToken;
          await authHandler.logout(authtoken);
          cliux.loader(''); //stops loading
          logger.info('successfully logged out');
          cliux.success('CLI_AUTH_LOGOUT_SUCCESS');
        }
      }
    } catch (error) {
      logger.error('Logout failed', error.message);
      cliux.print('CLI_AUTH_LOGOUT_FAILED', { color: 'yellow' });
      cliux.print(error.message, { color: 'red' });
    } finally {
      configHandler.delete('authtoken');
      configHandler.delete('email');
    }
  }
}