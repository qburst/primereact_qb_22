import { DocSectionCode } from '@/components/doc/common/docsectioncode';
import { DocSectionText } from '@/components/doc/common/docsectiontext';

export function CustomThemeDoc(props) {
    const code1 = {
        basic: `
sass --update themes/mytheme/theme.scss:themes/mytheme/theme.css
        `
    };

    const code2 = {
        basic: `
import './assets/theme.css';
        `
    };

    return (
        <>
            <DocSectionText {...props}>
                <p>
                    Themes are created with SASS using the <i>primereact-sass-theme</i> project available at <a href="http://github.com/primefaces/primereact-sass-theme">github</a>. This repository contains all the scss files for the components and
                    the variables of the built-in themes so that you may customize an existing theme or create your own. The scss variables used in a theme are available at the{' '}
                    <a href="https://www.primefaces.org/designer/api/primereact/9.0.0">SASS API</a> documentation.
                </p>
                <p>
                    There are 2 alternatives to create your own theme. First option is compiling a theme with command line sass and final alternative is embedding scss files within your project to let your build environment do the compilation. In all
                    cases, the generated theme file should be imported to your project. We've created a video tutorial that demonstrates all three options.
                </p>

                <h3>Theme SCSS</h3>
                <p>
                    The theme scss is available as open source at <a href="http://github.com/primefaces/primereact-sass-theme">primereact-sass-theme</a> repository. The <i>theme-base</i> folder contains the theming structure of the components, themes
                    under
                    <i>themes</i> folder import the base and define the SCSS variables. The <i>themes</i> folder also contains all the built-in themes so you can customize their code as well.
                </p>
                <p>
                    To create your own theme, <a href="https://github.com/primefaces/primereact-sass-theme/releases">download</a> the release matching your PrimeReact version and access the <i>themes/mytheme</i> folder. The sass variables to
                    customize are available under the
                    <i>variables</i> folder. The <i>_fonts</i> file can be used to define a custom font for your project whereas the optional <i>_extensions</i> file is provided to add overrides to the components designs. The <i>theme.scss</i> file
                    imports the theme files along with the <i>theme-base</i> folder at the root to combine everything together. Next step would be compilation of the scss that can either be command line or within your project.
                </p>

                <h3>Compile SCSS Manually</h3>
                <p>
                    Once your theme is ready run the following command to compile it. Note that <a href="https://www.npmjs.com/package/sass">sass</a> command should be available in your terminal.
                </p>
                <DocSectionCode code={code1} hideToggleCode import hideCodeSandbox hideStackBlitz />
                <p>
                    Then copy and import the theme.css file in your application. For example, in <a href="https://nextjs.org/docs/basic-features/built-in-css-support">Next.js</a>, ideal location could be the <i>_app.js</i>.
                </p>
                <DocSectionCode code={code2} hideToggleCode import hideCodeSandbox hideStackBlitz />

                <h3>Build Time Compilation</h3>
                <p>
                    This approach eliminates the manual compilation by delegating it to your build environment that has the ability to compile SCSS. Copy the <i>theme-base</i> folder along with <i>themes/mytheme</i> folder to your application where
                    assets reside. At a suitable entry point like <i>_app.js</i> or <i>index.js</i>, import the <i>theme.scss</i> from <i>assets/themes/mytheme</i>. That would be it, during build time, your project will compile the sass and import
                    the theme. Any changes to your theme will be reflected instantly.
                </p>
            </DocSectionText>
        </>
    );
}
