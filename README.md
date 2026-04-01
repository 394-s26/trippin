# React + TypeScript + Vite + Vitest

A starter template for building React 19+ apps in TypeScript with Vite and TailwindCSS 4. Includes Vitest for unit testing and
a hefty .gitignore file. React compiler enabled.

# Requirements

Node 22 or greater.

## Usage

To create a new app, run the following commands in your terminal, replacing `your-app-name` with the name of your app.

```
npx gitpick criesbeck/react-copilot your-app-name
cd your-app-name
npm install
```

## Test

There is no code to test. This is a shell for writing an app vision for CoPilot to fill in.

## Scripts

**package.json** defines the following scripts:

| Script           | Description                                         |
| -----------------| --------------------------------------------------- |
| npm run dev      | Runs the app in the development mode.               |
| npm run build    | Builds the app for production to the `dist` folder. |
| npm run serve    | Serves the production build from the `dist` folder. |
| npm test         | Starts a Jest-like test loop                        |
| npm run coverage | Runs the tests, displays code coverage results      |


## Git

If everything is working, set up [your local and remote repositories](https://docs.github.com/en/get-started/importing-your-projects-to-github/importing-source-code-to-github/adding-locally-hosted-code-to-github#adding-a-local-repository-to-github-using-git).

## Folder Structure

```
your-app-name
|-- .github
|   └── copilot-instructions.md
|-- docs
|   └── app-vision.md
├── public
│   └── robots.txt
│   ├── vite.svg
└── src
    ├── index.css
    ├── main.tsx
    ├── vite-env.d.ts
├── .gitignore
├── eslint.config.js
├── index.html
├── package.json
├── README.md
├── tsconfig.app.json
├── tsconfig.son
├── tsconfig.node.json
├── vite.config.ts
```

## Issues

Using TypeScript 5 and ESlint 9 until typescript-eslint and react hook plugins support TS 6 and ESL 10.

## Credits

Inspired by [SafdarJamal/vite-template-react](https://github.com/SafdarJamal/vite-template-react).
Expanded to include Vitest and some sample tests.

Thanks to Neeraj Dalal for [gitpick](https://github.com/nrjdalal/gitpick).

Gitignore file created with [the Toptal tool](https://www.toptal.com/developers/gitignore/api/react,firebase,visualstudiocode,macos,windows).


## License

This project is licensed under the terms of the [MIT license](./LICENSE).
