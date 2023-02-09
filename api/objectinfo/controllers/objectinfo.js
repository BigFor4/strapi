'use strict';

const { sanitizeEntity } = require("strapi-utils/lib");
const { searchTreeNode, shortenTree, setTitleRoot , searchTreeNodeForTowParents} = require("../../../tree");

/**
 * Read the documentation (https://strapi.io/documentation/developer-docs/latest/development/backend-customization.html#core-controllers)
 * to customize this controller
 */
const {
  Types: { ObjectId: ObjectId },
} = require("mongoose");

module.exports = {
  async getTreeObjectInfo(ctx) {
    const { modelType, fileid } = ctx.request.body
    let parent = ObjectId('ffffffffffffffffffffffff')
    const rootNodes = await strapi.query('objectinfo').model.aggregate([
      {
        $match: {
          $and: [
            { fileid },
            { parent },
            { type: { $ne: 5 } }
          ]
        }
      },
      {
        $addFields: {
          key: '$_id',
        }
      },
      {
        $graphLookup: {
          from: "datas",
          startWith: "$_id",
          connectFromField: "_id",
          connectToField: "parent",
          depthField: "level",
          as: "children",
          maxDepth: modelType === "ifc" ? 6 : 3
        }
      },
      {
        $addFields: {
          children: {
            $map: {
              input: '$children',
              as: 'child',
              in: {
                _id: '$$child._id',
                key: '$$child._id',
                node: '$$child._id',
                parent: '$$child.parent',
                title: '$$child.inf',
                GUID: '$$child.guid',
                type: '$$child.type',
                fileid: '$$child.fileid',
                projectid: '$$child.projectid',
                level: '$$child.level',
              },
            },
          },
        },
      },
      {
        $unwind: {
          path: "$children",
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $sort: {
          "children.level": -1
        }
      },
      {
        $group: {
          _id: '$_id',
          parent: {
            $first: '$parent',
          },
          key: {
            $first: '$_id',
          },
          node: {
            $first: '$_id',
          },
          title: {
            $first: '$inf',
          },
          type: {
            $first: '$type',
          },
          GUID: {
            $first: '$guid',
          },
          fileid: {
            $first: '$fileid',
          },
          projectid: {
            $first: '$projectid',
          },
          children: {
            $push: '$children',
          },
        },
      },
      {
        $addFields: {
          children: {
            $reduce: {
              input: "$children",
              initialValue: {
                level: -1,
                presentChild: [],
                prevChild: []
              },
              in: {
                $let: {
                  vars: {
                    prev: {
                      $cond: [
                        {
                          $eq: [
                            "$$value.level",
                            "$$this.level"
                          ]
                        },
                        "$$value.prevChild",
                        "$$value.presentChild"
                      ]
                    },
                    current: {
                      $cond: [
                        {
                          $eq: [
                            "$$value.level",
                            "$$this.level"
                          ]
                        },
                        "$$value.presentChild",
                        []
                      ]
                    }
                  },
                  in: {
                    level: "$$this.level",
                    prevChild: "$$prev",
                    presentChild: {
                      $concatArrays: [
                        "$$current",
                        [
                          {
                            $mergeObjects: [
                              "$$this",
                              {
                                children: {
                                  $filter: {
                                    input: "$$prev",
                                    as: "e",
                                    cond: {
                                      $eq: [
                                        "$$e.parent",
                                        "$$this._id"
                                      ]
                                    }
                                  }
                                }
                              }
                            ]
                          }
                        ]
                      ]
                    }
                  }
                }
              }
            }
          }
        }
      },
      {
        $addFields: {
          id: "$_id",
          children: "$children.presentChild"
        }
      }
    ]).allowDiskUse(true)
    let data = shortenTree(modelType, [...rootNodes], "", [], 0, "")
    if (modelType === "ifc") {
      data.data.map(item => {
        const title = setTitleRoot(item.type)
        item.title = title;
      })
    }
    return [...data.data];
  },
  async getTreeGuid(ctx) {
    const { guids, fileid , modelType} = ctx.request.body;
    let rootNodes = [];
    const getDataGuid = async (guid) => {
      let data = await strapi.query('objectinfo').model.aggregate([
        {
          $match: {
            $and: [{ fileid }, { guid }],
          },
        },
        {
          $lookup: {
            from: 'datas',
            localField: '_id',
            foreignField: '_id',
            as: 'data',
          },
        },
        {
          $project: {
            _id: { $arrayElemAt: ['$data._id', 0] },
            GUID: { $arrayElemAt: ['$data.guid', 0] },
            title: {
              $cond: {
                if: {
                  $eq: ['$data.name', [null]],
                },
                then: { $arrayElemAt: ['$data.inf', 0] },
                else: {
                  $cond: {
                    if: {
                      $eq: ['$data.name', []],
                    },
                    then: { $arrayElemAt: ['$data.inf', 0] },
                    else: { $arrayElemAt: ['$data.name', 0] },
                  },
                },
              },

            },
            fileid: { $arrayElemAt: ['$data.fileid', 0] },
            inf: { $arrayElemAt: ['$data.inf', 0] },
            projectid: { $arrayElemAt: ['$data.projectid', 0] },
            type: { $arrayElemAt: ['$data.type', 0] },
            parent: { $arrayElemAt: ['$data.parent', 0] },
          },
        },
        {
          $addFields: {
            key: '$_id',
          },
        },
        {
          $graphLookup: {
            from: 'datas',
            startWith: '$_id',
            connectFromField: '_id',
            connectToField: 'parent',
            depthField: 'level',
            as: 'children',
            maxDepth: 3,
          },
        },
        {
          $addFields: {
            children: {
              $map: {
                input: '$children',
                as: 'child',
                in: {
                  _id: '$$child._id',
                  key: '$$child._id',
                  GUID: '$$child.guid',
                  node: '$$child._id',
                  parent: '$$child.parent',
                  title: {
                    $cond: [
                      {
                        $eq: ['$$child.name', null],
                      },
                      '$$child.inf',
                      '$$child.name',
                    ],
                  },
                  Name: {
                    $cond: [
                      {
                        $eq: ['$$child.name', null],
                      },
                      '$$child.inf',
                      '$$child.name',
                    ],
                  },
                  inf: '$$child.inf',
                  type: '$$child.type',
                  fileid: '$$child.fileid',
                  projectid: '$$child.projectid',
                  level: '$$child.level',
                },
              },
            },
          },
        },
        {
          $unwind: {
            path: "$children",
            preserveNullAndEmptyArrays: true
          }
        },
        {
          $sort: {
            "children.level": -1
          }
        },
        {
          $group: {
            _id: '$_id',
            parent: {
              $first: '$parent',
            },
            key: {
              $first: '$_id',
            },
            node: {
              $first: '$_id',
            },
            title: {
              $first: '$title',
            },
            type: {
              $first: '$type',
            },
            GUID: {
              $first: '$GUID',
            },
            fileid: {
              $first: '$fileid',
            },
            projectid: {
              $first: '$projectid',
            },
            children: {
              $push: '$children',
            },
          },
        },
        {
          $addFields: {
            children: {
              $reduce: {
                input: "$children",
                initialValue: {
                  level: -1,
                  presentChild: [],
                  prevChild: []
                },
                in: {
                  $let: {
                    vars: {
                      prev: {
                        $cond: [
                          {
                            $eq: [
                              "$$value.level",
                              "$$this.level"
                            ]
                          },
                          "$$value.prevChild",
                          "$$value.presentChild"
                        ]
                      },
                      current: {
                        $cond: [
                          {
                            $eq: [
                              "$$value.level",
                              "$$this.level"
                            ]
                          },
                          "$$value.presentChild",
                          []
                        ]
                      }
                    },
                    in: {
                      level: "$$this.level",
                      prevChild: "$$prev",
                      presentChild: {
                        $concatArrays: [
                          "$$current",
                          [
                            {
                              $mergeObjects: [
                                "$$this",
                                {
                                  children: {
                                    $filter: {
                                      input: "$$prev",
                                      as: "e",
                                      cond: {
                                        $eq: [
                                          "$$e.parent",
                                          "$$this._id"
                                        ]
                                      }
                                    }
                                  }
                                }
                              ]
                            }
                          ]
                        ]
                      }
                    }
                  }
                }
              }
            }
          }
        },
        {
          $addFields: {
            id: "$_id",
            children: "$children.presentChild"
          }
        }
      ]);
      return data
    }
    if (Array.isArray(guids)) {
      await Promise.all(guids.map(async guid => {
        let rootNode = await getDataGuid(guid)
        if (rootNode[0]) {
          rootNodes.push(rootNode[0])
        }
      }))
    } else if (guids) {
      let allParentGuid = await strapi.query('objectinfo').model.aggregate([
        {
          $match: {
            $and: [
              { fileid },
              { parent : ObjectId("ffffffffffffffffffffffff") },
              { type: { $ne: 5 } }
            ]
          }
        },
        {
          $addFields: {
            key: '$_id',
          }
        },
        {
          $graphLookup: {
            from: "datas",
            startWith: "$_id",
            connectFromField: "_id",
            connectToField: "parent",
            depthField: "level",
            as: "children",
            maxDepth: modelType === "ifc" ? 6 : 3
          }
        },
        {
          $match: {
            "children.guid": guids
          }
        },
        {
          $addFields: {
            children: {
              $map: {
                input: '$children',
                as: 'child',
                in: {
                  _id: '$$child._id',
                  key: '$$child._id',
                  node: '$$child._id',
                  parent: '$$child.parent',
                  title: '$$child.inf',
                  GUID: '$$child.guid',
                  type: '$$child.type',
                  fileid: '$$child.fileid',
                  projectid: '$$child.projectid',
                  level: '$$child.level',
                },
              },
            },
          },
        },
        {
          $unwind: {
            path: "$children",
            preserveNullAndEmptyArrays: true
          }
        },
        {
          $sort: {
            "children.level": -1
          }
        },
        {
          $group: {
            _id: '$_id',
            parent: {
              $first: '$parent',
            },
            key: {
              $first: '$_id',
            },
            node: {
              $first: '$_id',
            },
            title: {
              $first: '$inf',
            },
            type: {
              $first: '$type',
            },
            GUID: {
              $first: '$guid',
            },
            fileid: {
              $first: '$fileid',
            },
            projectid: {
              $first: '$projectid',
            },
            children: {
              $push: '$children',
            },
          },
        },
        {
          $addFields: {
            children: {
              $reduce: {
                input: "$children",
                initialValue: {
                  level: -1,
                  presentChild: [],
                  prevChild: []
                },
                in: {
                  $let: {
                    vars: {
                      prev: {
                        $cond: [
                          {
                            $eq: [
                              "$$value.level",
                              "$$this.level"
                            ]
                          },
                          "$$value.prevChild",
                          "$$value.presentChild"
                        ]
                      },
                      current: {
                        $cond: [
                          {
                            $eq: [
                              "$$value.level",
                              "$$this.level"
                            ]
                          },
                          "$$value.presentChild",
                          []
                        ]
                      }
                    },
                    in: {
                      level: "$$this.level",
                      prevChild: "$$prev",
                      presentChild: {
                        $concatArrays: [
                          "$$current",
                          [
                            {
                              $mergeObjects: [
                                "$$this",
                                {
                                  children: {
                                    $filter: {
                                      input: "$$prev",
                                      as: "e",
                                      cond: {
                                        $eq: [
                                          "$$e.parent",
                                          "$$this._id"
                                        ]
                                      }
                                    }
                                  }
                                }
                              ]
                            }
                          ]
                        ]
                      }
                    }
                  }
                }
              }
            }
          }
        },
        {
          $addFields: {
            id: "$_id",
            children: "$children.presentChild"
          }
        }
      ]).allowDiskUse(true)
      let guidSearch = await strapi.query('objectinfo').model.aggregate([
        {
          $match: {
            $and: [
              { fileid },
              { guid: guids }
            ]
          }
        },
        {
          $addFields: {
            key: '$_id',
          }
        },
        {
          $group: {
            _id: '$_id',
            parent: {
              $first: '$parent',
            },
            key: {
              $first: '$_id',
            },
            node: {
              $first: '$_id',
            },
            title: {
              $first: '$inf',
            },
            type: {
              $first: '$type',
            },
            GUID: {
              $first: '$guid',
            },
            fileid: {
              $first: '$fileid',
            },
            projectid: {
              $first: '$projectid',
            },
            children: {
              $push: '$children',
            },
          },
        },
      ]).allowDiskUse(true)

      let newGuids = [];
      let data = shortenTree(modelType, [...allParentGuid], "", [], 0, "")
      let twoParent = searchTreeNodeForTowParents(data.data, guidSearch[0].key.toString())?.filter(x => x) || [];
      twoParent.map(item => {
        if(item.GUID){
          newGuids.push(item.GUID)
        }
      })
      if(!newGuids.includes(guids)){
        newGuids.push(guids)
      }
      await Promise.all(newGuids.map(async guid => {
        let rootNode = await getDataGuid(guid)
        if (rootNode[0]) {
          rootNodes.push(rootNode[0])
        }
      }))
    }
    return rootNodes
  },
  async searchObjectInfor(ctx) {
    const user = ctx.state.user;
    const { _page, _limit, search, projectId, keyFolder } = ctx.request.body;
    const page = parseInt(_page)
    const limit = parseInt(_limit) || 100
    const startIndex = (page - 1) * limit || 0
    if (!user) return ctx.unauthorized();
    let entities;
    let project = await strapi.services.project.findOne({ id: projectId });
    if (!project) return ctx.notFound('Project not readlly exist');
    let dataTree = [];
    if (keyFolder) {
      dataTree = searchTreeNode(project.treeData, 'key', keyFolder);
      if (!Array.isArray(dataTree)) {
        dataTree = [dataTree];
      }
    } else {
      dataTree = project.treeData;
    }
    let listHashModel = []
    const getListHashModel = (treeData) => {
      treeData.map(item => {
        if (item.children) {
          getListHashModel(item.children)
        } else {
          if (item.hash && ['ifc', 'landxml'].includes(item.modelType)) {
            let hash = item.hash?.split('/') && item.hash?.split('/')[1] ? item.hash?.split('/')[1] : item.hash
            listHashModel.push(hash)
          }
        }
      })
    }

    getListHashModel(dataTree)
    if (search && search !== '') {
      entities = await strapi.query('objectinfo').model.find({ $and: [{ inf: { '$regex': search, '$options': 'i' } }, { fileid: { $in: listHashModel } }] })
        .sort({ createdAt: 'desc' })
        .skip(startIndex)
        .limit(limit)
    } else {
      entities = await strapi.query('objectinfo').model.find({ fileid: { $in: listHashModel } })
        .sort({ createdAt: 'desc' })
        .skip(startIndex)
        .limit(limit)
    }
    entities.map(entity =>
      sanitizeEntity(entity, { model: strapi.models.objectinfo })
    );
    return entities
  },
  async getMultipleObjectInfor(ctx) {
    const user = ctx.state.user;
    const { listIdObj } = ctx.request.body;
    if (!user) return ctx.unauthorized();
    let entities = await strapi.query('objectinfo').find({ _id: { $in: listIdObj } })
    entities.map(entity =>
      sanitizeEntity(entity, { model: strapi.models.objectinfo })
    );
    return entities
  }
};
