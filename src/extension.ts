import * as vscode from "vscode";
import axios from "axios";

export function activate(context: vscode.ExtensionContext) {
  let disposable = vscode.commands.registerCommand(
    "searchnpm.searchAndInstallPackage",
    async () => {
      const searchTerm = await vscode.window.showInputBox({
        prompt: "Enter the package name to search for:",
      });

      if (!searchTerm) {
        vscode.window.showErrorMessage("No search term provided.");
        return;
      }

      try {
        const progress = vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: "Searching for packages...",
            cancellable: false,
          },
          async (progress, token) => {
            progress.report({ increment: 0 });

            const packages = await searchNpmPackages(searchTerm);

            progress.report({ increment: 100 });
            return packages;
          }
        );

        const searchResults = await progress;

        if (searchResults.length === 0) {
          vscode.window.showInformationMessage(
            "No packages found matching the search term."
          );
          return;
        }

        const selectedPackage = await vscode.window.showQuickPick(
          searchResults,
          {
            placeHolder: "Select a package to install:",
          }
        );
        if (!selectedPackage) {
          vscode.window.showWarningMessage("No package selected.");
          return;
        }

        const selectedTerminalName = await selectTerminal();
        if (!selectedTerminalName) {
          vscode.window.showWarningMessage("No terminal selected.");
          return;
        }

        const action = await vscode.window.showInformationMessage(
          `Install ${selectedPackage.label} package?`,
          "Yes",
          "No"
        );
        if (action === "Yes") {
          await installPackage(selectedPackage.label, selectedTerminalName);
        } else {
          vscode.window.showInformationMessage(
            "Package installation cancelled."
          );
          return;
        }
      } catch (error: any) {
        vscode.window.showErrorMessage(
          `Error searching/installing packages: ${error.message}`
        );
      }
    }
  );

  context.subscriptions.push(disposable);
}

async function selectTerminal(): Promise<string | undefined> {
  const terminals = vscode.window.terminals.map((terminal) => terminal.name);

  if (terminals.length === 0) {
    vscode.window.showWarningMessage(
      "No terminals currently open. Please open at least one terminal."
    );
    return;
  }

  const terminalName = await vscode.window.showQuickPick(terminals, {
    placeHolder: "Select a terminal to use for package installation:",
  });

  if (!terminalName) {
    vscode.window.showWarningMessage("No terminal selected.");
    return;
  }

  return terminalName;
}

interface PackageQuickPickItem extends vscode.QuickPickItem {
  description: string;
}

async function searchNpmPackages(
  searchTerm: string
): Promise<PackageQuickPickItem[]> {
  const url = `https://registry.npmjs.org/-/v1/search?text=${encodeURIComponent(
    searchTerm
  )}&size=10`;
  const response = await axios.get(url);

  if (response.status !== 200) {
    throw new Error("Failed to fetch search results from npm.");
  }

  return response.data.objects.map((result: any) => ({
    label: result.package.name,
    description: result.package.description || "No description available",
  }));
}

async function installPackage(
  packageName: string,
  terminalName: string
): Promise<void> {
  const terminal = vscode.window.terminals.find(
    (terminal) => terminal.name === terminalName
  );
  if (!terminal) {
    throw new Error(`Terminal "${terminalName}" not found.`);
  }
  const installOptions = ["Regular Dependency", "Development Dependency"];
  const selectedOption = await vscode.window.showQuickPick(installOptions, {
    placeHolder: "Select how to install the package:",
  });

  if (!selectedOption) {
    vscode.window.showWarningMessage("No installation option selected.");
    return;
  }

  let saveOption = "";
  if (selectedOption === "Development Dependency") {
    saveOption = "--save-dev";
  }

  terminal.sendText("\x03");
  await new Promise((resolve) => setTimeout(resolve, 100));

  terminal.sendText(`npm install ${packageName} ${saveOption}`);
  terminal.show();
}
