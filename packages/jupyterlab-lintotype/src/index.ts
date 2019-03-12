import { NotebookPanel } from '@jupyterlab/notebook';

import {
  Diagnostic,
  CodeAction,
  MarkupContent
} from 'vscode-languageserver-types';

import { Cell } from '@jupyterlab/cells';

import { Token } from '@phosphor/coreutils';

import { ISignal } from '@phosphor/signaling';

export const NAME = '@deathbeds/jupyterlab-lintotype';
export const VERSION = '0.1.0';
export const PLUGIN_ID = `${NAME}:ILintotypeManager`;

export interface ILintotypeManager {
  lintifyNotebook(panel: NotebookPanel): void;
  linters: Map<string, ILintotypeManager.ILinter>;
  requestContext(context: ILintotypeManager.IMarkupContext): void;
  contextRequested: ISignal<
    ILintotypeManager,
    ILintotypeManager.IMarkupContext
  >;
  annotateNotebook(
    notebook: NotebookPanel,
    cell: Cell
  ): Promise<ILintotypeManager.ILintoTypeResponse>;
}

export const ILintotypeManager = new Token<ILintotypeManager>(PLUGIN_ID);

export namespace ILintotypeManager {
  export interface ILintoTypeResponse {
    request_id: number;
    annotations?: IAnnotationsBundle;
    metadata?: any;
  }

  export interface IMarkupContext {
    range: Range;
    content: MarkupContent;
    title: string;
  }

  export interface IAnnotationsBundle {
    [key: string]: {
      diagnostics?: Diagnostic[];
      code_actions?: CodeAction[];
      markup_contexts?: IMarkupContext[];
    };
  }

  export interface IInputMimeBundle {
    [key: string]: {
      cell_id: string;
      code: string;
    }[];
  }
  export interface IPos {
    line: number;
    col: number;
  }

  export interface ILinter {
    (cell_id: string, allCode: IInputMimeBundle, metadata: object): Promise<
      ILintoTypeResponse
    >;
  }
  export interface IAnnotationRenderer {
    lintifyNotebook(panel: NotebookPanel): void;
  }
}
