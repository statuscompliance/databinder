/**
 * Exports core functionality for data binding and linking
 */

// Export Linker class and related types
export { 
  Linker, 
  LinkerOptions, 
  PropertyMapping, 
  DatasourceMethodConfig, 
  DatasourceConfig as LinkerDatasourceConfig 
} from './Linker';

// Export DataBinder class and related types
export * from './DataBinder';
