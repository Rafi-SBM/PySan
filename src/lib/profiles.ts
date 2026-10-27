/**
 * Project profiles.
 *
 * A profile is a curated set of PEP 503 normalized name patterns. Patterns may
 * end in `*` to claim a namespace (`azure-*`). Nothing is matched by prefix
 * unless the pattern says so, which keeps `six` from claiming `sixpack`.
 */

export interface Profile {
  key: string;
  label: string;
  description: string;
  packages: readonly string[];
}

/**
 * Packaging, build and interpreter plumbing. These are never offered for
 * removal: uninstalling them breaks the environment or the tools that would
 * repair it.
 */
export const PROTECTED_PACKAGES: readonly string[] = [
  'pip',
  'setuptools',
  'wheel',
  'packaging',
  'virtualenv',
  'pipenv',
  'poetry',
  'poetry-core',
  'uv',
  'hatch',
  'hatchling',
  'flit',
  'flit-core',
  'build',
  'conda',
  'mamba',
  'distlib',
  'filelock',
  'platformdirs',
  'pkginfo',
  'importlib-metadata',
  'importlib-resources',
  'zipp',
  'typing-extensions',
  'setuptools-scm',
  'pyproject-hooks',
  'tomli',
  'tomlkit',
];

export const PROFILES: readonly Profile[] = [
  {
    key: 'data_science',
    label: 'Data science and analysis',
    description: 'Dataframes, notebooks and statistical plotting.',
    packages: [
      'pandas', 'numpy', 'scipy', 'scikit-learn', 'statsmodels', 'matplotlib',
      'seaborn', 'plotly', 'bokeh', 'altair', 'polars', 'pyarrow', 'duckdb',
      'ipython', 'ipykernel', 'ipywidgets', 'jupyter', 'jupyter-*', 'jupyterlab',
      'jupyterlab-*', 'notebook', 'nbformat', 'nbconvert', 'nbclient',
      'openpyxl', 'xlrd', 'xlsxwriter', 'tabulate', 'patsy', 'pingouin',
      'traitlets', 'comm', 'debugpy', 'prompt-toolkit', 'pygments', 'jedi',
      'parso', 'matplotlib-inline', 'contourpy', 'cycler', 'fonttools',
      'kiwisolver', 'pyparsing', 'joblib', 'threadpoolctl', 'tzdata',
    ],
  },
  {
    key: 'machine_learning',
    label: 'Machine learning and AI',
    description: 'Training frameworks, transformers and computer vision.',
    packages: [
      'torch', 'torchvision', 'torchaudio', 'tensorflow', 'tensorflow-*',
      'tensorboard', 'tensorboard-*', 'keras', 'jax', 'jaxlib', 'flax', 'optax',
      'transformers', 'tokenizers', 'datasets', 'accelerate', 'peft', 'trl',
      'diffusers', 'safetensors', 'huggingface-hub', 'sentence-transformers',
      'xgboost', 'lightgbm', 'catboost', 'optuna', 'mlflow', 'wandb',
      'opencv-python', 'opencv-python-headless', 'opencv-contrib-python',
      'pillow', 'scikit-image', 'imageio', 'albumentations', 'timm',
      'nltk', 'spacy', 'spacy-*', 'gensim', 'thinc', 'sentencepiece',
      'imbalanced-learn', 'shap', 'onnx', 'onnxruntime', 'einops',
      'openai', 'anthropic', 'langchain', 'langchain-*', 'llama-index',
      'tiktoken', 'sympy', 'networkx', 'triton', 'nvidia-*',
    ],
  },
  {
    key: 'web_backend',
    label: 'Web and API backends',
    description: 'HTTP frameworks, ORMs, servers and auth.',
    packages: [
      'django', 'django-*', 'djangorestframework', 'flask', 'flask-*',
      'fastapi', 'starlette', 'pydantic', 'pydantic-core', 'pydantic-settings',
      'uvicorn', 'uvloop', 'gunicorn', 'hypercorn', 'waitress', 'daphne',
      'sqlalchemy', 'alembic', 'psycopg', 'psycopg2', 'psycopg2-binary',
      'pymysql', 'mysqlclient', 'asyncpg', 'aiosqlite', 'pymongo', 'motor',
      'redis', 'celery', 'kombu', 'billiard', 'amqp', 'vine', 'flower',
      'requests', 'httpx', 'httpcore', 'aiohttp', 'urllib3', 'h11', 'h2',
      'werkzeug', 'jinja2', 'markupsafe', 'itsdangerous', 'click', 'blinker',
      'pyjwt', 'bcrypt', 'passlib', 'argon2-cffi', 'argon2-cffi-bindings',
      'cryptography', 'cffi', 'pycparser', 'python-multipart', 'email-validator',
      'graphene', 'strawberry-graphql', 'gql', 'graphql-core',
      'python-dotenv', 'greenlet', 'anyio', 'sniffio', 'asgiref', 'sqlparse',
    ],
  },
  {
    key: 'frontend_tooling',
    label: 'Frontend-adjacent tooling',
    description: 'Static asset pipelines and live-reload helpers.',
    packages: [
      'whitenoise', 'django-compressor', 'django-webpack-loader', 'libsass',
      'rcssmin', 'rjsmin', 'python-livereload', 'livereload', 'watchdog',
      'watchfiles', 'jsonschema', 'jsonschema-specifications', 'referencing',
      'rpds-py', 'brotli', 'csscompressor', 'htmlmin',
    ],
  },
  {
    key: 'automation',
    label: 'Automation and scripting',
    description: 'Scraping, browser control and command line tools.',
    packages: [
      'requests', 'beautifulsoup4', 'soupsieve', 'lxml', 'html5lib',
      'scrapy', 'parsel', 'w3lib', 'selenium', 'playwright', 'pyppeteer',
      'pyautogui', 'pynput', 'keyboard', 'mouseinfo', 'pyscreeze',
      'click', 'typer', 'rich', 'textual', 'questionary', 'inquirerpy',
      'argcomplete', 'pyyaml', 'toml', 'python-dotenv', 'tqdm', 'psutil',
      'schedule', 'apscheduler', 'paramiko', 'fabric', 'invoke', 'sh',
      'openpyxl', 'pypdf', 'pdfplumber', 'python-docx', 'pandas',
      'markdown-it-py', 'mdurl', 'shellingham', 'colorama',
    ],
  },
  {
    key: 'data_engineering',
    label: 'Data engineering',
    description: 'Pipelines, warehouses and large scale processing.',
    packages: [
      'pyspark', 'dask', 'dask-*', 'distributed', 'ray', 'apache-airflow',
      'apache-airflow-*', 'prefect', 'dagster', 'dagster-*', 'dbt-core', 'dbt-*',
      'luigi', 'kafka-python', 'confluent-kafka', 'pyarrow', 'fastparquet',
      'sqlalchemy', 'pandas', 'polars', 'duckdb', 'boto3', 'botocore', 's3fs',
      'fsspec', 'gcsfs', 'adlfs', 'snowflake-connector-python',
      'google-cloud-bigquery', 'google-cloud-*', 'great-expectations',
      'pandera', 'cloudpickle', 'msgpack', 'tornado', 'zict', 'locket',
      'partd', 'toolz', 'fastavro',
    ],
  },
  {
    key: 'devops',
    label: 'DevOps and cloud',
    description: 'Infrastructure SDKs, provisioning and container tooling.',
    packages: [
      'boto3', 'botocore', 'awscli', 's3transfer', 'aws-sam-cli',
      'azure-*', 'msrest', 'msal', 'msal-extensions',
      'google-cloud-*', 'google-api-core', 'google-auth', 'google-auth-*',
      'googleapis-common-protos', 'protobuf', 'grpcio', 'grpcio-*',
      'ansible', 'ansible-core', 'ansible-*', 'docker', 'kubernetes',
      'openshift', 'pulumi', 'pulumi-*', 'checkov', 'cfn-lint',
      'paramiko', 'fabric', 'invoke', 'jmespath', 'pyopenssl', 'pynacl',
      'oauthlib', 'requests-oauthlib', 'websocket-client', 'durationpy',
    ],
  },
  {
    key: 'desktop_gui',
    label: 'Desktop applications',
    description: 'Native windowing toolkits and app packaging.',
    packages: [
      'pyqt5', 'pyqt5-*', 'pyqt6', 'pyqt6-*', 'pyside2', 'pyside6',
      'shiboken2', 'shiboken6', 'qtpy', 'wxpython', 'kivy', 'kivy-*',
      'customtkinter', 'ttkbootstrap', 'darkdetect', 'dearpygui', 'flet',
      'pyglet', 'toga', 'briefcase', 'pyinstaller', 'pyinstaller-hooks-contrib',
      'cx-freeze', 'nuitka', 'pywebview', 'eel',
    ],
  },
  {
    key: 'testing',
    label: 'Testing and quality',
    description: 'Test runners, linters, type checkers and formatters.',
    packages: [
      'pytest', 'pytest-*', 'unittest2', 'nose2', 'mock', 'coverage',
      'pytest-cov', 'tox', 'nox', 'hypothesis', 'faker', 'factory-boy',
      'freezegun', 'responses', 'respx', 'vcrpy', 'behave', 'robotframework',
      'selenium', 'playwright', 'locust', 'ruff', 'black', 'isort', 'flake8',
      'pylint', 'mypy', 'mypy-extensions', 'pyright', 'bandit', 'pre-commit',
      'pycodestyle', 'pyflakes', 'mccabe', 'astroid', 'dill', 'iniconfig',
      'pluggy', 'exceptiongroup', 'nodeenv', 'identify', 'cfgv',
    ],
  },
  {
    key: 'scientific',
    label: 'Scientific computing',
    description: 'Numerical kernels, symbolic maths and array formats.',
    packages: [
      'numpy', 'scipy', 'sympy', 'mpmath', 'numba', 'llvmlite', 'cython',
      'h5py', 'netcdf4', 'cftime', 'xarray', 'zarr', 'astropy', 'astropy-*',
      'biopython', 'rdkit', 'nibabel', 'sunpy', 'pint', 'uncertainties',
      'numexpr', 'bottleneck', 'pyfftw', 'meshio', 'vtk', 'trimesh',
    ],
  },
  {
    key: 'game_dev',
    label: 'Game development',
    description: 'Game loops, rendering and asset handling.',
    packages: [
      'pygame', 'pygame-ce', 'pyglet', 'arcade', 'ursina', 'panda3d',
      'panda3d-*', 'moderngl', 'moderngl-window', 'pymunk', 'pybox2d',
      'noise', 'perlin-noise', 'pytmx', 'esper',
    ],
  },
  {
    key: 'shared_runtime',
    label: 'Shared runtime libraries',
    description: 'Small libraries that almost every environment relies on.',
    packages: [
      'six', 'attrs', 'certifi', 'charset-normalizer', 'chardet', 'idna',
      'python-dateutil', 'pytz', 'tzlocal', 'decorator', 'wrapt',
      'more-itertools', 'sortedcontainers', 'frozenlist', 'multidict',
      'yarl', 'aiosignal', 'async-timeout', 'propcache', 'rpds-py',
      'pyyaml', 'requests', 'urllib3', 'typing-inspection', 'annotated-types',
    ],
  },
];

export const PROFILES_BY_KEY: ReadonlyMap<string, Profile> = new Map(
  PROFILES.map((profile) => [profile.key, profile]),
);

export function profileLabel(key: string): string {
  return PROFILES_BY_KEY.get(key)?.label ?? key;
}
