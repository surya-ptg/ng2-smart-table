import { Column } from './data-set/column';
import { Row } from './data-set/row';
import { DataSet } from './data-set/data-set';
import { DataSource } from './data-source/data-source';
import { Subject, Observable } from 'rxjs/Rx';

export class Grid {

  createFormShown: boolean = false;

  protected source: DataSource;
  protected settings: any;
  protected dataSet: DataSet;

  protected onSelectRowSource = new Subject<any>();

  constructor(source: DataSource, settings) {
    this.setSettings(settings);
    this.setSource(source);
  }

  getNewRow(): Row {
    return this.dataSet.newRow;
  }

  setSettings(settings: Object): void {
    this.settings = settings;
    this.dataSet = new DataSet([], this.getSetting('columns'));
  }

  getDataSet(): DataSet {
    return this.dataSet;
  }

  setSource(source: DataSource): void {
    this.source = this.prepareSource(source);

    this.source.onChanged().subscribe((changes) => this.processDataChange(changes));

    this.source.onUpdated().subscribe((data) => {
      let changedRow = this.dataSet.findRowByData(data);
      changedRow.setData(data);
    });
  }
  
  getSetting(name: string, defaultValue?: any): any {
    let keys = name.split('.');
    let level = this.settings;
    keys.forEach((k) => {
      if (level && typeof level[k] !== 'undefined') {
        level = level[k];
      }
    });
    
    return typeof level === 'undefined' ? defaultValue : level;
  }

  getColumns(): Array<Column> {
    return this.dataSet.getColumns();
  }

  getRows(): Array<Row> {
    return this.dataSet.getRows();
  }

  selectRow(row: Row): void {
    this.dataSet.selectRow(row);
  }

  onSelectRow(): Observable<any> {
    return this.onSelectRowSource.asObservable();
  }

  edit(row: Row): void {
    row.isInEditing = true;
  }

  // TODO: error handling
  create(row: Row): void {
    this.source.prepend(row.getNewData()).then(() => {
      this.createFormShown = false;
      this.dataSet.createNewRow();
    }).catch((e) => {
      console.error(e);
    });
  }

  // TODO: error handling
  save(row: Row): void {
    this.source.update(row.getData(), row.getNewData()).then(() => {
      row.isInEditing = false;
    }).catch((e) => {
      console.error(e);
    });
  }

  delete(row: Row): void {
    this.source.remove(row.getData()).then(() => {

    }).catch((e) => {
      console.error(e);
    });
  }
  
  protected processDataChange(changes): void {
    if (this.shouldProcessChange(changes)) {
      this.dataSet.setData(changes['elements']);
      let row = this.determineRowToSelect(changes);
      if (row) {
        this.onSelectRowSource.next(row);
      }
    }
  }
  
  protected shouldProcessChange(changes): boolean {
    if (['filter', 'sort', 'page', 'remove', 'refresh', 'load'].indexOf(changes['action']) !== -1) {
      return true;
    } else if (['prepend', 'append'].indexOf(changes['action']) !== -1 && !this.getSetting('pager.display')) {
      return true;
    }
    
    return false;
  }

  // TODO: move to selectable? Separate directive
  protected determineRowToSelect(changes): Row {

    if (['load', 'page', 'filter', 'sort', 'refresh'].indexOf(changes['action']) !== -1) {
      return this.dataSet.select();
    }
    if (changes['action'] === 'remove') {
      if (changes['elements'].length === 0) {
        // we have to store which one to select as the data will be reloaded
        this.dataSet.willSelectLastRow();
      } else {
        return this.dataSet.selectPreviousRow();
      }
    }
    if (changes['action'] === 'append') {
      // we have to store which one to select as the data will be reloaded
      this.dataSet.willSelectLastRow();
    }
    if (changes['action'] === 'add') {
      return this.dataSet.selectFirstRow();
    }
    if (changes['action'] === 'update') {
      return this.dataSet.selectFirstRow();
    }
    if (changes['action'] === 'prepend') {
      // we have to store which one to select as the data will be reloaded
      this.dataSet.willSelectFirstRow();
    }
    return null;
  }

  protected prepareSource(source): DataSource {
    let initialSource = this.getInitialSort();
    if (initialSource && initialSource['field'] && initialSource['direction']) {
      source.setSort([initialSource], false);
    }
    if (this.getSetting('pager.display') === true) {
      source.setPaging(1, this.getSetting('pager.perPage'), false);
    }

    source.refresh();
    return source;
  }

  protected getInitialSort() {
    let sortConf = {};
    this.getColumns().forEach((column: Column) => {
      if (column.isSortable && column.defaultSortDirection) {
        sortConf['field'] = column.id;
        sortConf['direction'] = column.defaultSortDirection;
        sortConf['compare'] = column.getCompareFunction();
      }
    });
    return sortConf;
  }
}
