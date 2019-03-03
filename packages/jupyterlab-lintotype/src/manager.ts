import CodeMirror from 'codemirror';

import { PromiseDelegate } from '@phosphor/coreutils';

import { NotebookPanel } from '@jupyterlab/notebook';
import { Cell } from '@jupyterlab/cells';

import { KernelMessage, Kernel } from '@jupyterlab/services';

import { NAME, ILintotypeManager } from '.';

export class LintotypeManager implements ILintotypeManager {
  private nextMsgId = 0;
  private promises = new Map<
    number,
    PromiseDelegate<LintotypeManager.IAnnoMimeBundle>
  >();
  private linters = new Map<string, LintotypeManager.ILinter>();

  lintifyNotebook(panel: NotebookPanel) {
    if (this.linters.has(panel.session.kernel.id)) {
      return;
    }

    this.registerCommTarget(panel.session.kernel);

    const onContentChanged = () => {
      for (const cell of panel.content.widgets) {
        const cm = (cell.editor as any)._editor as CodeMirror.Editor;
        if (!cm.getOption('lint')) {
          const { gutters, lint } = this.cmSettings(panel, cell);
          cm.setOption('gutters', gutters);
          cm.setOption('lint', lint);
        }
      }
    };

    panel.model.contentChanged.connect(onContentChanged);
    onContentChanged();
    // TODO: allow config in settings, notebook
    // const metaUpdated = (metadata: IObservableJSON) => {
    //   console.log('metadata', metadata);
    // };
    //
    // panel.model.metadata.changed.connect(metaUpdated);
    // metaUpdated(panel.model.metadata);
  }

  cmSettings(panel: NotebookPanel, currentCell: Cell) {
    return {
      gutters: ['CodeMirror-lint-markers'],
      lint: {
        async: true,
        hasGutter: true,
        delay: 50,
        getAnnotations: async (
          _code: string,
          callback: (annotations: any[]) => void
        ): Promise<void> => {
          let anno: LintotypeManager.IAnnoMimeBundle = {};
          let linter = this.linters.get(panel.session.kernel.id);

          if (linter) {
            let allCode: LintotypeManager.IInputMimeBundle = {};
            let { cells, metadata } = panel.model;
            let numCells = cells.length;
            for (let i = 0; i < numCells; i++) {
              let cell = cells.get(i);
              let cellCode = cell.value.text;
              if (!allCode[cell.mimeType]) {
                allCode[cell.mimeType] = [];
              }
              allCode[cell.mimeType].push({
                cell_id: cell.id,
                code: cellCode
              });
            }
            try {
              anno = await linter(currentCell.model.id, allCode, (metadata.get(
                NAME
              ) || {}) as object);
            } catch (err) {
              console.warn(err);
            }
          }
          callback(
            anno[currentCell.model.mimeType].map(pos => {
              return {
                ...pos,
                from: new CodeMirror.Pos(pos.from.line, pos.from.col),
                to: new CodeMirror.Pos(pos.to.line, pos.to.col)
              };
            })
          );
        }
      }
    };
  }

  registerCommTarget(kernel: Kernel.IKernelConnection) {
    kernel.registerCommTarget(
      NAME,
      async (comm: Kernel.IComm, _msg: KernelMessage.ICommOpenMsg) => {
        this.linters.set(
          kernel.id,
          async (
            cellId: string,
            code: LintotypeManager.IInputMimeBundle,
            metadata: object
          ) => {
            let requestId = this.nextMsgId++;
            let promise = new PromiseDelegate<
              LintotypeManager.IAnnoMimeBundle
            >();
            this.promises.set(requestId, promise);
            comm.send({
              request_id: requestId,
              cell_id: cellId,
              code,
              metadata: metadata as any
            });
            return await promise.promise;
          }
        );

        comm.onMsg = (msg: KernelMessage.ICommMsgMsg) => {
          let requestId: number = (msg.content.data as any).request_id;
          this.promises
            .get(requestId)
            .resolve((msg.content.data as any).annotations);
        };
      }
    );
  }
}

export namespace LintotypeManager {
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

  export interface IAnnotation {
    message: string;
    severity: string;
    from: IPos;
    to: IPos;
  }

  export interface IAnnoMimeBundle {
    [key: string]: IAnnotation[];
  }

  export interface ILinter {
    (cell_id: string, allCode: IInputMimeBundle, metadata: object): Promise<
      IAnnoMimeBundle
    >;
  }
}
