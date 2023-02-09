const { v4: uuidv4 } = require('uuid');

const META_DATA_TYPES = {
  IFC_PROPERTIES: 10,
  IFC_HEADER_INFO: 13,
  IFC_SHOW_TREE: 7,
  LANDXML_ATTRIBUTES: 5,
  LANDXML_META: 6,
  LANDXML_FEATURE: 10,
}

const META_DATA_KEYS = {
  DEFINITION: 'Definition',
  FileSchemas: 'Set of FileSchemas'
}

const LANDXML_OBJ = {
  PIPENETWORKS: 'PipeNetworks',
  SURFACES: 'Surfaces',
  CGPOINTS: 'CgPoints',
  Alignments: 'Alignments',
  PlanFeatures: 'PlanFeatures',
  Project: 'Project',
  CoordinateSystem: 'CoordinateSystem'
}

const LANDXML_KEY = {
  UNITS: 'Units',
  FeatureDictionary: 'FeatureDictionary',
}

function searchTreeNode(data, key, match) {
  const stack = [];
  data.map(item => stack.push(item));
  while (stack.length > 0) {
    const node = stack.pop();
    if (node[key] === match) {
      return node;
    } else if (node.children) {
      node.children.map(child => stack.push(child))
    }
  }
  return null;
}

function searchTreeNodeForTowParents(data, match) {
  const nodes = []
  const searchParent = (dataTree, match) => {
    dataTree.map(item => {
      if(nodes.length < 2){
        if(item.children?.find(x=> x.key.toString() === match)){
          if(item.GUID){
            nodes.unshift(item);
          }
          searchParent(data , item.key)
        }else if (item.children){
          searchParent(item.children ,  match)
        }
      }
    })
  }
  searchParent(data, match)
  return nodes
}
function searchTreeNodeForParent(data, key, match) {
  const stack = [];

  function compareArr(n = [], k, d) {
    n.forEach((v, i) => {
      if (v[k] === d) {
        return n;
      }
    });
  }
  data.map(item => stack.push(item));
  while (stack.length > 0) {
    const node = stack.pop();
    if (node[key] === match) {
      return node.parrent;
    }
    if (node.children && node.children.length) {
      if (compareArr(node.children, key, match)) {
        return node;
      }
      else {
        node.children.forEach(child => {
          child.parrent = node
          stack.push(child)
        })
      }
    }
  }
  return null;
}

function traversalOTree(data) {
  return data.map(item => {
    if (item.children) {
      const title = item.title ? item.title : setTitleRoot(item.children[0].type)
      return {
        ...item,
        title,
        key: item.node ? item.node : uuidv4(),
        children: traversalOTree(item.children),
      };
    }
    return {
      ...item,
      title: item.title,
      key: item.node ? item.node : uuidv4(),
    };
  });
}

function setTitleRoot(type) {
  switch (type) {
    case 2:
    case 8:
      return "Not referenced"
    case 6:
      return "Space Boundaries"
    case 7:
    case 9:
      return "IfcProject"
    case 13:
      return "Header Info"
    default:
      return ""
  }
}

function shortenTree(modelType, data, version, attrData, level = 0, rootUnits) {
  if (modelType === 'landxml') {
    data.map((item) => {

      let units = null;
      if (item.children) {
        units = item.children.find(child => child.title === LANDXML_KEY.UNITS);
      }
      else {

      }
      if (level === 0 && item.children && units) {
        let FeatureDictionary = item.children.find(child => child.title === LANDXML_KEY.FeatureDictionary);

        rootUnits = buildUnitsObject(units.children[0].children[0].children);
        if(FeatureDictionary && FeatureDictionary.children.length > 0){
          rootFeatureDictionary = buildUnitsObject(FeatureDictionary.children[0].children);
          if (rootFeatureDictionary.version) {
            version.name = rootFeatureDictionary.name + ' ' + rootFeatureDictionary.version
          }
        }

        //rootUnits = {...rootUnits, ...rootFeatureDictionary}
        item.children = item.children.filter(item => Object.values(LANDXML_OBJ).includes(item.title))
      }
      const unitMapper = units ? buildUnitsObject(units.children[0].children[0].children) : rootUnits;

      if (item.children) {
        const attributes = item.children.find(child => child.type === META_DATA_TYPES.LANDXML_ATTRIBUTES || child.type === META_DATA_TYPES.LANDXML_META);
        const features = item.children.filter(child => child.type === META_DATA_TYPES.LANDXML_FEATURE);
        const definition = item.children.find(child => child.title === META_DATA_KEYS.DEFINITION);
        if(definition && !definition.GUID){
          definition.GUID = uuidv4()
        }
        const newChildren = item.children.filter(child => child.type !== META_DATA_TYPES.LANDXML_ATTRIBUTES && child.type !== META_DATA_TYPES.LANDXML_FEATURE && child.title !== META_DATA_KEYS.DEFINITION);
        if (!item.GUID) {
          item.GUID = uuidv4()
        }
        if (definition) {
          item.GUID = definition.GUID;
        }
        if (features && features.length) {
          const childAttr = groupChildAttr(features);
          if (attributes && attributes.children && childAttr && childAttr.length) {
            attributes.children = [...attributes.children, ...childAttr];
          } else if (attributes && childAttr && childAttr.length) {
            attributes.children = childAttr;
          }
        }
        if (attributes && attributes.children && attributes.children.length) {
          if (definition) {
            const definitionAttributes = definition.children.find(child => child.type === META_DATA_TYPES.LANDXML_ATTRIBUTES);
            if (definitionAttributes && definitionAttributes.children && definitionAttributes.children.length) {
              definitionAttributes.children.map(definitionAttribute => attributes.children.push(definitionAttribute));
            }
          }
          const nameAttr = attributes.children.find(o => o.title.startsWith('name='));
          if (nameAttr) {
            item.title = `${item.title} '${nameAttr.title.split('=')[1]}'`;
          }
          buildAttrUnit(unitMapper, attributes.children);
        }


        attrData.push({
          ...attributes,
          pKey: item.key,
          pTitle: item.title,
          GUID: item.GUID,
          version
        });
        item.children = newChildren;
        item.isLeaf = !newChildren.length;

        if (item.children && item.children.length) {
          shortenTree(modelType, item.children, version, attrData, level + 1, rootUnits)
        } else {
          delete item.children;
        }
      } else {

        item.isLeaf = true
      }
    })
  } else if (modelType === 'ifc') {
    data.map(item => {
      const properties = item.children && item.children.find(child => child.type === META_DATA_TYPES.IFC_PROPERTIES);
      if (properties && properties.children) {
        properties.children.unshift({
          key: uuidv4(),
          title: `GlobalID = ${properties.GUID || ''}`,
        })
        item.GUID = properties.GUID
      } else if (properties) {
        properties.children = [{
          key: uuidv4(),
          title: `GlobalID = ${properties.GUID || ''}`,
        }]
        item.GUID = properties.GUID
      }
      if (item.children && item.children[0] && item.children[0].type === META_DATA_TYPES.IFC_HEADER_INFO) {
        const fileSchemas = item.children.find(x => x.title === META_DATA_KEYS.FileSchemas)
        if (fileSchemas && fileSchemas.children) {
          const ifcversion = buildUnitsObject(fileSchemas.children)
          if (ifcversion && Object.keys(ifcversion).length) {
            version.name = ifcversion[Object.keys(ifcversion)[0]]
          }
        }
        attrData.push({
          ...item,
          pKey: item.key,
          pTitle: item.title,
          version
        });
      } else {
        attrData.push({
          ...properties,
          pKey: item.key,
          pTitle: item.title,
          version
        });
      }
      if (item.children) {
        const newChildren = [];
        item.children.map(child => {
          if (child.type === META_DATA_TYPES.IFC_SHOW_TREE) {
            newChildren.push(child);
          } else {
            if (child.children) {
              child.children.map(gchild => {
                if (gchild.type === META_DATA_TYPES.IFC_SHOW_TREE) {
                  newChildren.push(gchild);
                }
              })
            }
          }
        })
        item.children = newChildren;
        item.isLeaf = !newChildren.length
        shortenTree(modelType, item.children, version, attrData, level + 1)
      } else {
        item.isLeaf = true
      }
    })
  }
  return {
    data,
    attrData
  };
}

function groupChildAttr(data) {
  data.map(item => {
    if (item.children) {
      const attributes = item.children.find(child => child.type === META_DATA_TYPES.LANDXML_ATTRIBUTES);
      const newChildren = item.children.filter(child => child.type !== META_DATA_TYPES.LANDXML_ATTRIBUTES);
      if (item.type === META_DATA_TYPES.LANDXML_FEATURE) {
        item.title = `${attributes.children[0] ? attributes.children[0].title.split('=')[1] : ''} '${attributes.children[1]
          ? attributes.children[1].title.split('=')[1] : ''}'`;
      } else {
        item.title = `${attributes.children[0] ? attributes.children[0].title.split('=')[1] : ''}=${attributes.children[1]
          ? attributes.children[1].title.split('=')[1] : ''}`;
      }
      item.children = newChildren;
      if (item.children && item.children.length) {
        groupChildAttr(item.children);
      } else {
        delete item.children;
      }
    }
  })
  return data;
}

function buildUnitsObject(unitList) {
  const units = {};
  (unitList || []).forEach(item => {
    const splitItem = item.title.split('=');
    if (splitItem.length) {
      units[splitItem[0]] = splitItem[1];
    }
  });
  return units;
}

function buildAttrUnit(unitMapper, data) {
  data.map(item => {
    if (item.title && isNumeric(item.title.split('=')[1])) {
      if (item.title.toLowerCase().includes('diameter')) {
        item.unit = unitMapper.diameterUnit;
      }
      if (item.title.toLowerCase().includes('elev')) {
        item.unit = unitMapper.diameterUnit;
      }
      if (item.title.toLowerCase().includes('thickness') || item.title.toLowerCase().includes('width')) {
        item.unit = unitMapper.widthUnit;
      }
      if (item.title.toLowerCase().includes('height')) {
        item.unit = unitMapper.heightUnit;
      }
      if (item.title.toLowerCase().includes('volume') || item.title.toLowerCase().includes('area')) {
        item.unit = unitMapper.areaUnit;
      }

    }
    if (item.children) {
      buildAttrUnit(unitMapper, item.children);
    }
  })
  return data;
}

function isNumeric(str) {
  if (typeof str != "string") return false
  return !isNaN(str) &&
    !isNaN(parseFloat(str))
}

module.exports = {
  searchTreeNode,
  traversalOTree,
  shortenTree,
  setTitleRoot,
  searchTreeNodeForTowParents
};
