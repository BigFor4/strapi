'use strict';
/**
 * Read the documentation (https://strapi.io/documentation/developer-docs/latest/development/backend-customization.html#core-controllers)
 * to customize this controller
 */
const {
  Types: { ObjectId: ObjectId },
} = require("mongoose");
const tree = require("./../../../tree")
module.exports = {
  async getTreeObjectInfo(ctx) {
    const { fileid } = ctx.params
    let modelType = "ifc"
    let parent = ObjectId('ffffffffffffffffffffffff')
    const rootNodes = await strapi.query('objectinfo').model.aggregate([
      {
        $match: {
          $and: [
            { fileid },
            { parent }
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
          maxDepth: 100
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
                parent: '$$child.parent',
                title: '$$child.inf',
                GUID: '$$child.guid',
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
          title: {
            $first: '$inf',
          },
          type: {
            $first: '$type',
          },
          GUID: {
            $first: '$guid',
          },
          inf: {
            $first: '$inf',
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
    let data = tree.shortenTree(modelType, [...rootNodes], modelType === "ifc" ? "IFCReader 2.0" : "LandXmlReader 2.0", [], 0, "")
    return data;
  },
  async getTreeGuid(ctx) {
    const { guids, fileid } = ctx.request.body;
    let rootNodes = [];
    if (guids?.length > 0) {
      await Promise.all(guids.map(async guid => {
        let rootNode = await strapi.query('objectinfo').model.aggregate([
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
                  else: { $arrayElemAt: ['$data.name', 0] },
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
        if(rootNode[0]){
          rootNodes.push(rootNode[0])
        }
      }))
    }
    return rootNodes
  }
};
