/**
 * 表格构建工具 3.0
 *
 * - 零 DOM 操作，大幅提高构建效率。返回结果为字符串
 * - 无需浏览器环境，不依赖 jQuery 等其他插件，前后台通用。需要更快的速度可以在服务端使用 js 引擎构建
 * - 代码结构简化优化，提高可维护性
 * -
 * - var tb =  TableBuilder.build_table(opts); // 创建表格，返回 tb 对象
 * - wrapper.innerHTML = tb.table.toString(); // tb.table 是虚拟表格对象，调用 toString 返回 html 表格字符串
 *
 * @since 2020/5/20
 * @author romp
 * @version 3.0
 * @version 3.0.20200522 调整代码结构，处理各种细节问题。
 * @version 3.0.20200525 本层有多个分组支时，支持显示分组信息
 * @version 3.0.20200527 支持数字型、标签型出现在主栏上。改名为 tablebuilder
 * @version 3.0.20200618 修改默认单元格id生成规则，提供自定义生成接口
 * @version 3.01.20200628 表头添加colgroup，便于按列控制
 * @version 3.02.20200711 列头行头添加 meta-key 属性，便于根据 key 找到对应的单元格
 * @version 3.03.20200714 修复行头 intent和text 结构错误的问题
 * @version 3.04.20200730 修复某些情况下列头生成的列key不对的问题
 * @version 3.05.20200804 新增 load_data 方法加载数据；修复行总数相关问题
 */

/*------------------------------------------ default settings ----------------------------------------------*/
// 默认选项
TableBuilder.defaults = {
  body_nodes: [], // 表体节点，用于生成主栏
  header_nodes: [], // 表头节点，用于生成表头

  show_row_num: true, // 行序号
  show_col_num: true, // 列序号
  show_code: true, // 行代码
  show_dic_title: false, // 是否显示字典型的字典自身信息。建议不显示，用标签来实现

  indent_code: false, // 代码列是否缩进
  indent_model: true, // 行嵌套时是否显示以缩进方式显示

  caption: null, // 标题行，若为空，则不生成

  row_title: "分组", // 当主栏部分出现多个分组时，显示一个统一的标题
  code_title: "代码", // 代码列的名称
  single_total: "总计", // 没有传入行节点时，是否自动生成一个行，行名
  sub_total: "合计", // 小计行的名称。为假则不生成

  data_model: "map", //数据填入形式。map模式：数据为一个map，key 就是数据单元格的 id
  data: null, // 数据

  paging: false, // 是否分页
  page_size: 20, // 启用分页时，每页行数
  current_page: 0, // 启用分页时，当前显示第几页

  col_num_chs: "甲乙丙丁戊己庚辛寅卯", // 列序号，主栏部分的序号。可传空字符串

  key_of_single_total_row: "totalrow", // 总计行的 key

  gen_cell_key: function(row_key, col_key) {
    return row_key
      .split("_")
      .concat(col_key.split("_"))
      .sort()
      .join("_");
  }, // 自定义 cell_key 生成函数

  // 解析类型回调。要返回 TableBuilder.node_types 中的值
  extract_node_type: function(node) {
    return node.type;
  },
  // 转换节点参数。必须返回 key, text
  extract_node_info: function(node) {
    return {
      key: node.key,
      text: node.text || "",
    };
  },
  // 转换子项参数。必须返回 key, text
  extract_item_info: function(item, node) {
    return {
      key: item.key,
      text: item.text || "",
      code: item.code,
    };
  },
};

TableBuilder.classes = {
  table: "tablebuilder-table",

  col_header: "col-head",
  col_row: "col-row",
  col_header_blank: "col-head-blank",

  row_item_row: "row-item-row",
  row_item_header: "row-item-head",
  row_title_row: "row-title-row",
  row_title_header: "row-title-head",
  row_code: "row-code-head",

  data_cell: "data-cell",
  no_data: "no-data",
  cell_text: "cell-text",
  cell_indent: "cell-indent",

  row_num: "row-num",
  row_num_blank: "row-num-blank",

  col_num_row: "col-num-row",
  col_num_ch: "col-num-ch",
  col_num_digit: "col-num-digit",
  col_num_blank: "col-num-blank",

  colgroup_rn: "colgroup_rn",
  colgroup_row: "colgroup_row",
  colgroup_col: "colgroup_col",
};

TableBuilder.node_types = {
  NUM: "num",
  DIC: "dic",
  LABEL: "label",
};

TableBuilder.meta_types = {
  NUM: "num",
  DIC: "dic",
  LABEL: "label",
  ITEM: "item",
  BLANK: "blank",
};

/*------------------------------------------ static methods start ----------------------------------------------*/
/**
 * TableBuilder 实例
 */
function TableBuilder(opts) {
  this.opts = opts;
  this.version = "3.0";

  this.body_nodes;
  this.parsed_body_nodes;
  this.table_body;

  this.paged_body_nodes;

  this.header_nodes;
  this.parsed_header_nodes;
  this.table_header;

  this.table;

  this.colgroup;

  this.table_body_cost_colnum;
  this.table_header_cost_colnum;
  this.table_header_cost_rownum;
  this.total_colnum; // 总列数，包含行部分
  this.total_rownum; // 总行数，不包含表头部分。不是当前分页的行数，而是总行数
  this.total_rownum_current; // 总行数，不包含表头部分。真实表格行数，分页时为当前也的行数

  this.is_single_total_row;

  this.has_num_in_row;
  this.has_dic_in_row;
  this.has_label_in_row;

  this._col_index_to_col_key;
  this._col_key_to_cell;
  this._row_n_level_children_count;
}

/**
 * 创建表格
 */
TableBuilder.build_table = function(opts) {
  return new TableBuilder(opts)._build();
};

/**
 * 将解析好的表头表体拼到一起，并补足空白的单元格，生成示例需要的基本属性
 */
TableBuilder.prototype._build = function() {
  // 与默认设置合并参数
  for (var key in TableBuilder.defaults) {
    if (!(key in this.opts)) {
      this.opts[key] = TableBuilder.defaults[key];
    }
  }

  this.header_nodes = this.opts.header_nodes;
  this.body_nodes = this.opts.body_nodes;

  // 当无主栏行时，是否自动生成一个 总计 行
  this._deal_with_single_total_row();

  // 主栏每一层节点数量。用于判断主栏是否显示分组名
  this._row_n_level_children_count = this.init_row_n_level_children_count();

  // 解析表头节点
  this.parsed_header_nodes = this._parse_table_header();
  // 解析主栏节点
  if (!this.is_single_total_row) {
    this.parsed_body_nodes = this._parse_table_body();
  }

  // 处理数字型出现在主栏的情况
  this._deal_with_num_in_row();

  // 处理分页问题。截取行节点
  this._deal_with_paging();

  // 求表头占据的行数
  this.table_header_cost_rownum =
    TableBuilder.get_rowspan({
      children: this.parsed_header_nodes,
    }) - 1;
  if (this.opts.show_col_num) {
    this.table_header_cost_rownum++;
  }

  // 求表头部分占据的列数
  this.table_header_cost_colnum = this._count_table_header_cost_colnum();
  // 主栏部分占据的列数量
  this.table_body_cost_colnum = this._count_table_body_cost_colnum();
  // 得到表格总列数
  this.total_colnum =
    this.table_header_cost_colnum + this.table_body_cost_colnum;

  // 生成表头
  this.table_header = this._create_table_header();
  // 生成主栏
  if (this.opts.indent_model) {
    this.table_body = this._create_table_body_indent();
  } else {
    this.table_body = this._create_table_body();
  }

  // 初始化列序号与列 key 的对应关系，便于以后使用
  this._col_index_to_col_key = this._init_col_index_to_col_key();

  // 填充表头
  this._fill_table_header();

  // 填充表体
  this._fill_table_body();

  // 表头表体拼到一起
  this._put_together();

  return this;
};

TableBuilder.get_attr_str = function(attrs) {
  var attr_str = "";
  for (var key in attrs) {
    attr_str += " " + key + '="' + attrs[key] + '"';
  }
  return attr_str;
};

TableBuilder.Cell = function() {
  this.key = "";
  this.text = "";
  this.indent = 0;
  this.is_blank = false;
  this.attrs = {};
  this.toString = function() {
    // 属性
    var attr_str = TableBuilder.get_attr_str(this.attrs);

    // 值
    var value_str = "<span class=" + TableBuilder.classes.cell_text + ">";
    value_str += this.is_blank
      ? "&nbsp;"
      : this.text === undefined || this.text === null
      ? ""
      : String(this.text);
    value_str += "</span>";

    // 左侧缩进
    var indent_str = "";
    if (this.indent > 0) {
      var indent_str = "<span class=" + TableBuilder.classes.cell_indent + ">";
      indent_str += TableBuilder.create_indent(this.indent);
      indent_str += "</span>";
    }

    return "<td" + attr_str + ">" + indent_str + value_str + "</td>";
  };
};

TableBuilder.Row = function() {
  this.attrs = {};
  this.cells = [];
  this.toString = function() {
    var attr_str = TableBuilder.get_attr_str(this.attrs);
    var cells_str = "";
    for (var i = 0; i < this.cells.length; i++) {
      cells_str += this.cells[i].toString();
    }
    return "<tr" + attr_str + ">" + cells_str + "</tr>";
  };
};

TableBuilder.Col = function() {
  this.attrs = {};
  this.toString = function() {
    var attr_str = TableBuilder.get_attr_str(this.attrs);
    return "<col" + attr_str + "></col>";
  };
};

TableBuilder.Table = function() {
  this.caption = "";
  this.colgroup = [];
  this.attrs = {};
  this.thead = [];
  this.tbody = [];
  this.tfoot = [];
  this.toString = function() {
    var attr_str = TableBuilder.get_attr_str(this.attrs);
    var thead_str = "";
    for (var i = 0; i < this.thead.length; i++) {
      thead_str += this.thead[i].toString();
    }
    var tbody_str = "";
    for (var i = 0; i < this.tbody.length; i++) {
      tbody_str += this.tbody[i].toString();
    }

    var caption_str = "";
    if (!this.caption) {
      this.caption = "";
    }
    caption_str = "<caption>" + this.caption + "</caption>";

    var colgroup_str = "";
    if (this.colgroup && this.colgroup.length) {
      colgroup_str += "<colgroup>";
      for (var i = 0; i < this.colgroup.length; i++) {
        var col = this.colgroup[i];
        colgroup_str += col.toString();
      }
      colgroup_str += "</colgroup>";
    }

    return (
      "<table" +
      attr_str +
      ">" +
      caption_str +
      colgroup_str +
      "<thead>" +
      thead_str +
      "</thead><tbody>" +
      tbody_str +
      "</tbody></table>"
    );
  };
};

TableBuilder.is_function = function(o) {
  return o && typeof o == "function";
};

/**
 * 获取树形结构子级的最深层级
 * @param {*} node
 * @param {*} parent_level
 */
TableBuilder.get_max_child_level = function(node, parent_level) {
  if (node.children && node.children.length) {
    var this_level = parent_level === undefined ? 1 : parent_level + 1;

    var max_child_level = 0;

    for (var i = 0; i < node.children.length; i++) {
      max_child_level = Math.max(
        TableBuilder.get_max_child_level(node.children[i], this_level),
        max_child_level
      );
    }

    return max_child_level;
  }
  return parent_level || 1;
};

/**
 * 获取树形结构子级第 N 层下面的最深层级
 * @param {*} node
 * @param {*} n
 */
TableBuilder.get_n_level_max_child_level = function(nodes, n) {
  var max = 0;

  function recursion(nodes, this_level) {
    if (nodes && nodes.length) {
      this_level = this_level || 0;
      if (this_level == n) {
        max = Math.max(
          max,
          TableBuilder.get_max_child_level({
            children: nodes,
          })
        );
        return;
      }
      for (var i = 0; i < nodes.length; i++) {
        recursion(nodes[i].children, this_level + 1);
      }
    }
  }

  recursion(nodes);

  return max;
};

/**
 * 获取节点子级节点的总数
 * @param {*} node
 */
TableBuilder.get_children_count = function(node) {
  var counter = 0;

  function recursion(nodes) {
    if (nodes && nodes.length) {
      for (var i = 0; i < nodes.length; i++) {
        counter++;
        recursion(nodes[i].length);
      }
    }
  }
  recursion(node.children);
  return counter;
};

/**
 * 获取节点叶子节点的总数
 * @param {*} node
 */
TableBuilder.get_leaf_children_count = function(node) {
  var counter = 0;

  function recursion(nodes) {
    if (nodes && nodes.length) {
      for (var i = 0; i < nodes.length; i++) {
        var node = nodes[i];
        if (node.children && node.children.length) {
          recursion(node.children);
        } else {
          counter++;
        }
      }
    }
  }
  recursion(node.children);
  return counter;
};

/**
 * 获取节点中第 n 层最多的节点数
 * @param {*} nodes
 * @param {*} n
 */
TableBuilder.get_n_level_max_children_count = function(nodes, n) {
  var max = 0;

  function recursion(nodes, this_level) {
    if (nodes && nodes.length) {
      this_level = this_level || 0;
      if (this_level == n) {
        max = Math.max(max, nodes.length);
        return;
      }
      for (var i = 0; i < nodes.length; i++) {
        recursion(nodes[i].children, this_level + 1);
      }
    }
  }

  recursion(nodes);
  return max;
};

/**
 * 获取节点中第 n 层所有节点数量
 * @param {*} nodes
 * @param {*} n
 */
TableBuilder.get_n_level_all_children_count = function(nodes, n) {
  var result = 0;

  function recursion(nodes, this_level) {
    if (nodes && nodes.length) {
      this_level = this_level || 0;
      if (this_level == n) {
        result += nodes.length;
        return;
      }
      for (var i = 0; i < nodes.length; i++) {
        recursion(nodes[i].children, this_level + 1);
      }
    }
  }

  recursion(nodes);
  return result;
};

/**
 * 获取节点中第 n 层第一个存在的节点
 * @param {*} nodes
 * @param {*} n
 */
TableBuilder.get_n_level_first_node = function(nodes, n) {
  function recursion(nodes, this_level) {
    if (nodes && nodes.length) {
      this_level = this_level || 0;
      if (this_level == n) {
        return nodes[0];
      }

      for (var i = 0; i < nodes.length; i++) {
        var target = recursion(nodes[i].children, this_level + 1);
        if (target) {
          return target;
        }
      }
    }
    return null;
  }

  return recursion(nodes);
};

/**
 * 求节点的 colspan
 */
TableBuilder.get_colspan = function(node) {
  if (node.children && node.children.length) {
    var colspan = 0;
    for (var i = 0; i < node.children.length; i++) {
      colspan += TableBuilder.get_colspan(node.children[i]);
    }
    return colspan;
  }
  return 1;
};

/**
 * 求节点的 rowspan。每多一级，rowspan + 1。等于最深的 child 层级
 */
TableBuilder.get_rowspan = function(node) {
  return TableBuilder.get_max_child_level(node) + 1;
};

// 生成列序号
TableBuilder.get_col_num_ch = function(index, chs) {
  // 超过10列，变为甲甲，甲乙...甲甲甲...
  var result = "";
  index = index.toString(10);
  for (var i = 0; i < index.length; i++) {
    result += chs.charAt(parseInt(index.charAt(i), 10));
  }
  return result;
};

/**
 * 克隆一个对象。浅克隆，只克隆第一层属性
 * @param except 要排除的属性
 */
TableBuilder.clone = function(o, except) {
  var cloned = {};
  for (var key in o) {
    if (except.indexOf(key) == -1) {
      cloned[key] = o[key];
    }
  }
  return cloned;
};

TableBuilder.create_indent = function(n) {
  var indent = "";
  for (var i = 0; i < n; i++) {
    indent += "&nbsp;&nbsp;&nbsp;&nbsp;";
  }
  return indent;
};

/*------------------------------------------ static methods end ----------------------------------------------*/

/*------------------------------------------- crete table header start ----------------------------------------------*/
/**
 * 将表头节点解析为扁平模式，便于处理
 */
TableBuilder.prototype._parse_table_header = function() {
  var opts = this.opts;

  function recursion_nodes(nodes) {
    var result = [];
    if (nodes && nodes.length) {
      for (var i = 0; i < nodes.length; i++) {
        var node = nodes[i];

        var node_type = opts.extract_node_type(node);
        // num
        if (node_type == TableBuilder.node_types.NUM) {
          // extract info
          var new_node = opts.extract_node_info(node);
          new_node.meta_type = TableBuilder.meta_types.NUM;
          result.push(new_node);

          // recursion children
          if (node.children && node.children.length) {
            // 数字型的空白格要加 key，以实现对下级 col-key 的影响
            var blank_node = {};
            blank_node.key = new_node.key;
            blank_node.is_blank = true;
            blank_node.meta_type = TableBuilder.meta_types.BLANK;
            blank_node.children = recursion_nodes(node.children);

            new_node._blank_node = blank_node;
            result.push(blank_node);
          }
        }
        // dic
        else if (node_type == TableBuilder.node_types.DIC) {
          // recursion items of dic
          result = result.concat(recursion_items(node.items, node));
        }
        // label
        else if (node_type == TableBuilder.node_types.LABEL) {
          // extract info
          var new_node = opts.extract_node_info(node);
          new_node.meta_type = TableBuilder.meta_types.LABEL;

          // recursion children
          if (node.children && node.children.length) {
            new_node.children = recursion_nodes(node.children);
          }

          result.push(new_node);
        }
      }
    }
    return result;
  }
  // recursion items
  function recursion_items(items, node) {
    var result = [];
    if (items && items.length) {
      for (var i = 0; i < items.length; i++) {
        var item = items[i];

        // extract item info
        var new_node = opts.extract_item_info(item, node);
        new_node.meta_type = TableBuilder.meta_types.ITEM;
        result.push(new_node);

        // recursion item children
        if (item.children && item.children.length) {
          // 字典父项产生的空白格，不加 key，以实现 col-key 不体现字典项的层级
          var blank_node = {};
          blank_node.is_blank = true;
          blank_node.children = recursion_items(item.children, node);
          blank_node.meta_type = TableBuilder.meta_types.BLANK;

          new_node._blank_node = blank_node;
          result.push(blank_node);
        }

        // recursion node children
        if (node.children && node.children.length) {
          new_node.children = recursion_nodes(node.children);
        }
      }
    }
    return result;
  }

  // final result
  return recursion_nodes(this.header_nodes);
};

/**
 * 生成表头
 */
TableBuilder.prototype._create_table_header = function() {
  var all_nodes = this.parsed_header_nodes;

  var rows = [];

  var col_index = 0;

  var level_rowspan = [];

  function recursion_nodes(nodes, path, parent_level) {
    if (nodes && nodes.length) {
      // 当前层级
      var this_level = parent_level === undefined ? 0 : parent_level + 1;
      // 保存路径
      if (!path) {
        path = [];
      }

      // 根据层级取行
      var this_row = rows[this_level];
      if (!this_row) {
        this_row = rows[this_level] = new TableBuilder.Row();
        this_row.attrs.class = TableBuilder.classes.col_row;
      }

      // 本层节点的 rowspan，应取本层节点的 最大深度
      var this_level_rowspan = level_rowspan[this_level];
      if (this_level_rowspan === undefined) {
        this_level_rowspan = TableBuilder.get_n_level_max_child_level(
          all_nodes,
          this_level
        );
        level_rowspan[this_level] = this_level_rowspan;
      }

      for (var i = 0; i < nodes.length; i++) {
        var node = nodes[i];

        var cell = new TableBuilder.Cell();
        cell.key = node.key;
        cell.text = node.text;
        if (node.is_blank) {
          cell.is_blank = true;
          cell.attrs.class = TableBuilder.classes.col_header_blank;
        } else {
          cell.attrs.class = TableBuilder.classes.col_header;
        }
        cell.attrs["meta-type"] = node.meta_type || "";
        cell.attrs["meta-key"] = node.key || "";

        this_row.cells.push(cell);

        // 计算跨列
        cell.attrs.colspan = TableBuilder.get_colspan(node) || 1;

        // 计算跨行。节点的 children 已被转移到其对应的空白节点。使用其空白节点的子项来判断自身 rowspan
        if (!(node.children && node.children.length)) {
          cell.attrs.rowspan = this_level_rowspan || 1;
        }

        // 根据节点路径设置 col-key
        if (cell.key) {
          path.push(cell.key);
        }

        cell.attrs["key-path"] = path.join("_");

        if (node.children && node.children.length) {
          // 递归子级
          recursion_nodes(node.children, path, this_level);
        } else {
          cell.attrs["col-key"] = path.join("_");
          cell.attrs["col-index"] = col_index++;
        }

        // 修复某些情况下多 pop 一次的问题
        if (cell.key) {
          path.pop();
        }
      }
    }
  }

  recursion_nodes(this.parsed_header_nodes);

  // 生成列序号
  if (this.opts.show_col_num) {
    rows.push(this._create_col_num_row());
  }

  return rows;
};

/*------------------------------------------- crete table header end ----------------------------------------------*/

/*------------------------------------------- crete table body start----------------------------------------------*/
/**
 *
 * 解析表体节点，生成主栏部分基本结构
 */
TableBuilder.prototype._parse_table_body = function() {
  var context = this;
  var opts = this.opts;

  function recursion_nodes(nodes, parent_node_level) {
    var result = [];
    if (nodes && nodes.length) {
      var this_node_level =
        parent_node_level === undefined ? 0 : parent_node_level + 1;

      for (var i = 0; i < nodes.length; i++) {
        var node = nodes[i];
        var node_type = opts.extract_node_type(node);

        // 支持数字型、标签
        if (
          node_type == TableBuilder.node_types.NUM ||
          node_type == TableBuilder.node_types.LABEL
        ) {
          var new_node = opts.extract_node_info(node);
          new_node.level = 0;

          if (node_type == TableBuilder.node_types.NUM) {
            context.has_num_in_row = true;
            new_node.meta_type = TableBuilder.meta_types.NUM;
          } else if (node_type == TableBuilder.node_types.LABEL) {
            context.has_label_in_row = true;
            new_node.meta_type = TableBuilder.meta_types.LABEL;
          }

          result.push(new_node);

          if (node.children && node.children.length) {
            new_node.children = recursion_nodes(node.children, this_node_level);
          }
        }
        // 字典
        else if (node_type == TableBuilder.node_types.DIC) {
          context.has_dic_in_row = true;
          // recursion items of dic
          result = result.concat(
            recursion_items(node.items, node, this_node_level)
          );
        }
      }
    }
    return result;
  }

  // recursion items
  function recursion_items(items, node, parent_node_level, parent_item_level) {
    var result = [];
    if (items && items.length) {
      var this_item_level =
        parent_item_level === undefined ? 0 : parent_item_level + 1;

      for (var i = 0; i < items.length; i++) {
        var item = items[i];

        // extract item info
        var new_node = opts.extract_item_info(item, node);
        new_node.level = this_item_level;
        new_node.meta_type = TableBuilder.meta_types.ITEM;

        // 添加一个分组信息节点
        if (i == 0 && this_item_level == 0 && opts.show_dic_title) {
          var row_title_node = opts.extract_node_info(node);
          row_title_node.level = new_node.level;
          row_title_node.meta_type = TableBuilder.meta_types.DIC;
          result.push(row_title_node);
        }
        result.push(new_node);

        // recursion item children
        if (item.children && item.children.length) {
          result = result.concat(
            recursion_items(
              item.children,
              node,
              parent_node_level,
              this_item_level
            )
          );
        }

        // recursion node children
        if (node.children && node.children.length) {
          new_node.children = recursion_nodes(node.children, parent_node_level);
        }
      }
    }
    return result;
  }

  // final result
  var result = recursion_nodes(this.body_nodes);

  return result;
};

/**
 * 构建表格体。rowspan 模式
 */
TableBuilder.prototype._create_table_body = function() {
  var opts = this.opts;
  var rows = [];

  var row_index = 0;

  // 处理分页的行序号 FIXME 跨行时有误
  if (opts.paging) {
    row_index = opts.current_page * opts.page_size;
  }

  var start = row_index;

  function recursion_nodes(nodes, path, parent_row, parent_level) {
    // 保存路径
    if (!path) {
      path = [];
    }

    if (nodes && nodes.length) {
      var this_level = parent_level === undefined ? 0 : parent_level + 1;

      for (var i = 0; i < nodes.length; i++) {
        var node = nodes[i];

        var row;
        // 第一个节点与父级使用相同的行
        if (parent_row && i === 0) {
          row = parent_row;
        } else {
          row = new TableBuilder.Row();
          row.attrs.class = TableBuilder.classes.row_item_row;
          row_index++;
          rows.push(row);
        }

        var cell = new TableBuilder.Cell();
        cell.key = node.key;
        cell.text = node.text;
        cell.indent = node.level;
        cell.attrs.class = TableBuilder.classes.row_item_header;
        cell.attrs["meta-type"] = node.meta_type || "";
        cell.attrs["meta-key"] = node.key || "";
        // 计算跨行。单元格的跨行，等于其叶子节点的总数
        cell.attrs.rowspan = TableBuilder.get_leaf_children_count(node) || 1;

        // 有可能是分组标题信息节点
        if (node.meta_type == TableBuilder.meta_types.DIC) {
          cell.attrs.class = TableBuilder.classes.row_title_header;
          row.attrs.class = TableBuilder.classes.row_title_row;
        }

        // 处理行序号
        if (opts.show_row_num) {
          // 第一层的节点才添加
          if (this_level === 0) {
            var row_num_cell = new TableBuilder.Cell();
            row_num_cell.text = String(row_index);
            row_num_cell.attrs.class = TableBuilder.classes.row_num;
            row_num_cell.attrs.rowspan = cell.attrs.rowspan;
            row.cells.push(row_num_cell);
          }
        }

        row.cells.push(cell);

        // 代码
        if (opts.show_code) {
          var code_cell = new TableBuilder.Cell();
          code_cell.text = node.code;
          if (opts.indent_code) {
            code_cell.indent = cell.indent;
          }
          code_cell.attrs.class = TableBuilder.classes.row_code;
          code_cell.attrs.rowspan = cell.attrs.rowspan;
          row.cells.push(code_cell);
        }

        // 根据节点路径设置 row-key
        if (cell.key) {
          path.push(cell.key);
        }
        row.attrs["row-key"] = path.join("_");

        // 递归子级
        recursion_nodes(node.children, path, row, this_level);

        path.pop();
      }
    }
  }

  var nodes = this.parsed_body_nodes;
  if (opts.paging) {
    nodes = this.paged_body_nodes;
  }
  recursion_nodes(nodes);

  if (!opts.paging) {
    this.total_rownum = row_index;
  }

  this.total_rownum_current = row_index - start;

  return rows;
};

/**
 * 构建表格体。indent 模式
 */
TableBuilder.prototype._create_table_body_indent = function() {
  var opts = this.opts;
  var rows = [];

  var row_index = 0;

  // 处理分页的行序号
  if (opts.paging) {
    row_index = opts.current_page * opts.page_size;
  }

  var start = row_index;

  function recursion_nodes(nodes, path, parent_indent, parent_level) {
    // 保存路径
    if (!path) {
      path = [];
    }
    if (nodes && nodes.length) {
      var this_level = parent_level === undefined ? 0 : parent_level + 1;

      for (var i = 0; i < nodes.length; i++) {
        var node = nodes[i];

        // indent 模式，不产生跨行
        var row = new TableBuilder.Row();
        row.attrs.class = TableBuilder.classes.row_item_row;
        row_index++;

        rows.push(row);

        var cell = new TableBuilder.Cell();
        cell.key = node.key;
        cell.text = node.text;
        cell.indent = node.level + (parent_indent ? parent_indent : 0);
        cell.attrs["meta-type"] = node.meta_type || "";
        cell.attrs["meta-key"] = node.key || "";
        cell.attrs.class = TableBuilder.classes.row_item_header;

        // 有可能是分组标题信息节点
        if (node.meta_type == TableBuilder.meta_types.DIC) {
          cell.attrs.class = TableBuilder.classes.row_title_header;
          row.attrs.class = TableBuilder.classes.row_title_row;
        }

        // 处理行序号
        if (opts.show_row_num) {
          // 第一层的节点才添加
          if (this_level === 0) {
            var row_num_cell = new TableBuilder.Cell();
            row_num_cell.text = String(row_index);
            row_num_cell.attrs.class = TableBuilder.classes.row_num;
            row.cells.push(row_num_cell);
          }
        }

        row.cells.push(cell);

        // 代码
        if (opts.show_code) {
          var code_cell = new TableBuilder.Cell();
          code_cell.text = node.code;
          if (opts.indent_code) {
            code_cell.indent = cell.indent;
          }
          code_cell.attrs.class = TableBuilder.classes.row_code;
          row.cells.push(code_cell);
        }

        // 根据节点路径设置 row-key
        if (cell.key) {
          path.push(cell.key);
        }
        row.attrs["row-key"] = path.join("_");

        // 递归子级
        recursion_nodes(node.children, path, cell.indent + 1);

        path.pop();
      }
    }
  }

  var nodes = this.parsed_body_nodes;
  if (opts.paging) {
    nodes = this.paged_body_nodes;
  }
  recursion_nodes(nodes);

  if (!opts.paging) {
    this.total_rownum = row_index;
  }

  this.total_rownum_current = row_index - start;

  return rows;
};

/*------------------------------------------ crete table body end ----------------------------------------------*/

/*------------------------------------------ TableBuilder instance start ----------------------------------------------*/

/**
 * 初始化 主栏节点树每层节点数量
 */
TableBuilder.prototype.init_row_n_level_children_count = function() {
  var result = [];
  var n = TableBuilder.get_max_child_level({
    children: this.body_nodes,
  });
  for (var i = 0; i < n; i++) {
    result[i] = TableBuilder.get_n_level_all_children_count(this.body_nodes, i);
  }
  return result;
};

/**
 * 初始化 列序号和列 key 的关系
 */
TableBuilder.prototype._init_col_index_to_col_key = function() {
  var col_index_to_col_key = [];
  for (var i = 0; i < this.table_header.length; i++) {
    var row = this.table_header[i];
    for (var j = 0; j < row.cells.length; j++) {
      var cell = row.cells[j];
      var col_index = cell.attrs["col-index"];
      if (col_index !== undefined) {
        col_index_to_col_key[col_index] = cell.attrs["col-key"];
      }
    }
  }
  return col_index_to_col_key;
};

/**
 * 求表头部分占据的列数，等于第一行单元格的 colspan 之和
 */
TableBuilder.prototype._count_table_header_cost_colnum = function() {
  var counter = 0;
  for (var i = 0; i < this.parsed_header_nodes.length; i++) {
    counter += TableBuilder.get_colspan(this.parsed_header_nodes[i]) || 1;
  }
  return counter;
};

/**
 * 求主栏部分占据的列数量
 */
TableBuilder.prototype._count_table_body_cost_colnum = function() {
  var counter = 0;

  // indent 模式，主栏都在一列
  if (this.opts.indent_model) {
    counter = 1;
    if (this.opts.show_code) {
      counter++;
    }
  }
  //跨行模式，等于主栏节点的最大层级。为什么不用第一行单元格 colspan 之和？考虑当第二个孩子节点的深度比第一个深时
  else {
    counter = TableBuilder.get_max_child_level({
      children: this.parsed_body_nodes,
    });
    if (this.opts.show_code) {
      counter *= 2;
    }
  }

  // 显示行序号，则多出一列
  if (this.opts.show_row_num) {
    counter++;
  }

  return counter;
};

/**
 * 获取对应层级应该的分组名
 *
 * @param {int} level 层级
 */
TableBuilder.prototype._get_group_title_name = function(level) {
  if (this.opts.indent_model) {
    if (
      this.body_nodes &&
      this.body_nodes.length == 1 &&
      !(this.body_nodes[0] && this.body_nodes[0].children)
    ) {
      return this.opts.extract_node_info(this.body_nodes[0]).text;
    }
  } else {
    var count = TableBuilder.get_n_level_all_children_count(
      this.body_nodes,
      level
    );
    if (count == 1) {
      var node = TableBuilder.get_n_level_first_node(this.body_nodes, level);
      if (node) {
        return this.opts.extract_node_info(node).text;
      }
    }
  }
  return this.opts.row_title;
};

/**
 * 根据主栏占据的列数，将表头补足
 */
TableBuilder.prototype._fill_table_header = function() {
  var cells = [];

  var colgroup = [];

  var rowspan = this.table_header_cost_rownum;
  // 不能跨到列序号行
  if (this.opts.show_col_num) {
    rowspan--;
  }

  var n = this.table_body_cost_colnum;
  // 若显示行序号，会多出一列
  if (this.opts.show_row_num) {
    var cell = new TableBuilder.Cell();
    cell.attrs.rowspan = rowspan;
    cell.attrs.class = TableBuilder.classes.row_num_blank;
    cells.push(cell);

    var col = new TableBuilder.Col();
    col.attrs.class = TableBuilder.classes.colgroup_rn;
    colgroup.push(col);

    n--;
  }

  for (var i = 0; i < n; i++) {
    var cell = new TableBuilder.Cell();
    cell.attrs.rowspan = rowspan;
    cells.push(cell);

    var col = new TableBuilder.Col();
    col.attrs.class = TableBuilder.classes.colgroup_row;
    colgroup.push(col);

    // 在这里处理分组在表头显示的名称
    if (this.opts.show_code) {
      var should_show_code_title = i % 2;
      if (should_show_code_title) {
        cell.text = this.opts.code_title;
      } else {
        cell.text = this._get_group_title_name(i / 2);
      }
    } else {
      cell.text = this._get_group_title_name(i);
    }
  }
  var first_row = this.table_header[0];
  first_row.cells = cells.concat(first_row.cells);

  // 宾栏部分
  for (var i = 0; i < this.table_header_cost_colnum; i++) {
    var col = new TableBuilder.Col();
    col.attrs.class = TableBuilder.classes.colgroup_col;
    col.attrs["col-key"] = this.get_col_key(i);

    colgroup.push(col);
  }

  this.colgroup = colgroup;
};

/**
 * 根据总列数，给表体右侧补足空白列。并分析哪些单元格可以作为填数据的单元格
 */
TableBuilder.prototype._fill_table_body = function() {
  this._col_key_to_cell = {};

  // 主栏右侧补足表头多出来的列。同时生成数据格子的 col-key,col-index,row-key,cell-key 等
  var rowspan_affect = [];

  for (var i = 0; i < this.table_body.length; i++) {
    // 第 i 行
    var row = this.table_body[i];
    var cell_num = row.cells.length;

    // 本行第一列的起始索引。会受前面行 rowspan 的影响
    var this_row_start = 0;

    // 本行需要填充 n 个格子
    var n = this.total_colnum - row.cells.length;

    for (var j = 0; j < rowspan_affect.length; j++) {
      if (rowspan_affect[j] > 0) {
        n--;
        this_row_start++;
        rowspan_affect[j]--;
      }
    }

    var col_index = 0;

    for (var j = 0; j < n; j++) {
      var cell = new TableBuilder.Cell();

      // 可能存在空白但不能放数据的格子
      if (j + cell_num + this_row_start < this.table_body_cost_colnum) {
        cell.attrs.class = TableBuilder.classes.no_data;
      }
      // 放数据的单元格，设置各种属性，便于以后使用
      else {
        cell.attrs.class = TableBuilder.classes.data_cell;
        cell.attrs["row-index"] = i;
        var row_key = row.attrs["row-key"];
        if (row_key) {
          cell.attrs["row-key"] = row_key;
        }

        // 列序号，从 0 开始
        cell.attrs["col-index"] = col_index;
        var col_key = this.get_col_key(col_index);
        if (col_key) {
          cell.attrs["col-key"] = col_key;
        }

        col_index++;

        if (row_key && col_key) {
          var cell_key;
          if (TableBuilder.is_function(this.opts.gen_cell_key)) {
            // 提供一个自定义 cell_key 的机会
            cell_key = this.opts.gen_cell_key(row_key, col_key);
          }

          cell.attrs["id"] = cell_key;

          // 便于根据 cell_key 找单元格
          this._col_key_to_cell[cell_key] = cell;
        }

        // 填数据
        if (this.opts.data && this.opts.data_model == "map") {
          cell.text = this.opts.data[cell_key];
        }
      }

      row.cells.push(cell);
    }

    // rows span 会影响后面的 rowspan - 1 行
    for (var j = 0; j < row.cells.length; j++) {
      var rowspan = row.cells[j].attrs.rowspan;
      if (rowspan > 1) {
        var m = rowspan_affect[j + this_row_start] || 0;
        rowspan_affect[j + this_row_start] = m + (rowspan - 1);
      }
    }
  }
};

/**
 * 处理当无行节点时自动生成一个 总计行 的情况
 */
TableBuilder.prototype._deal_with_single_total_row = function() {
  var opts = this.opts;
  if (
    !(this.opts.body_nodes && this.opts.body_nodes.length) &&
    this.opts.single_total
  ) {
    this.body_nodes = [
      {
        key: opts.key_of_single_total_row,
        text: this.opts.single_total,
        type: TableBuilder.node_types.DIC,
        items: [
          {
            key: opts.key_of_single_total_row,
            id: opts.key_of_single_total_row,
            text: this.opts.single_total,
          },
        ],
      },
    ];
    this.parsed_body_nodes = [
      {
        key: "totalrow",
        text: this.opts.single_total,
      },
    ];
    this.is_single_total_row = true;
    this.opts.show_code = false;
  }
};

/**
 * 生成列序号的行
 *
 */
TableBuilder.prototype._create_col_num_row = function() {
  var row = new TableBuilder.Row();
  row.attrs.class = TableBuilder.classes.col_num_row;

  var n_ch = this.table_body_cost_colnum;
  if (this.opts.show_row_num) {
    var cell = new TableBuilder.Cell();
    cell.attrs.class = TableBuilder.classes.col_num_blank;
    row.cells.push(cell);
    n_ch = this.table_body_cost_colnum - 1;
  }

  // 中文部分
  for (var i = 0; i < n_ch; i++) {
    var cell = new TableBuilder.Cell();
    cell.text = TableBuilder.get_col_num_ch(i, this.opts.col_num_chs);
    cell.attrs.class = TableBuilder.classes.col_num_ch;
    row.cells.push(cell);
  }

  // 数字部分
  var n_digit = this.table_header_cost_colnum;
  for (var i = 0; i < n_digit; i++) {
    var cell = new TableBuilder.Cell();
    cell.text = String(i + 1);
    cell.attrs.class = TableBuilder.classes.col_num_digit;
    row.cells.push(cell);
  }

  return row;
};

/**
 * 获取列 key
 * @param {int} col_index 列索引
 */
TableBuilder.prototype.get_col_key = function(col_index) {
  return this._col_index_to_col_key[col_index];
};

/**
 * 表头表体拼到一起
 */
TableBuilder.prototype._put_together = function() {
  this.table = new TableBuilder.Table();
  this.table.thead = this.table_header;
  this.table.tbody = this.table_body;
  this.table.attrs.class = TableBuilder.classes.table;
  this.table.caption = this.opts.caption;
  this.table.colgroup = this.colgroup;
};

/**
 * 生成行序号
 *
 * @param {boolean} is_hide 为 false 则隐藏
 */
TableBuilder.prototype.show_row_num = function(is_hide) {
  // TODO
};

/**
 * 生成列序号
 *
 * @param {boolean} is_hide 为 false 则隐藏
 */
TableBuilder.prototype.show_col_num = function(is_hide) {
  // TODO
};

/**
 * 处理分页。使用截取行节点的方式实现
 */
TableBuilder.prototype._deal_with_paging = function() {
  var opts = this.opts;

  if (!opts.paging) {
    return;
  }

  if (opts.is_single_total_row) {
    this.paged_body_nodes = this.parsed_body_nodes;
    this.total_rownum = 1;
  }

  var counter = 0;
  var start = opts.current_page * opts.page_size;
  var end = (opts.current_page + 1) * opts.page_size - 1;
  var paged_body_nodes = [];

  function recursion(nodes, parent_node, level) {
    var level = level || 0;
    if (nodes && nodes.length) {
      for (var i = 0; i < nodes.length; i++) {
        var node = nodes[i];

        var cloned = TableBuilder.clone(node, ["children"]);
        cloned.parent = parent_node;

        // 范围内处理
        if (counter === start) {
          // 最顶层，放到 paged 最外层
          var temp = cloned;
          while (temp.parent) {
            if (!temp.parent.children) {
              temp.parent.children = [];
            }
            temp.parent.children.push(temp);
            temp = temp.parent;
          }
          paged_body_nodes.push(temp);
        }

        // 范围内
        if (counter > start && counter <= end) {
          if (parent_node) {
            if (!parent_node.children) {
              parent_node.children = [];
            }
            parent_node.children.push(cloned);
          } else {
            paged_body_nodes.push(cloned);
          }
        }

        // counter 增加
        if (parent_node && opts.indent_model === false && i === 0) {
          // 跨行模式，每层第一个子项与父级使用同一行
          // 故不增加
        } else {
          counter++;
        }

        recursion(node.children, cloned, level + 1);

        // 继续，计算出总行数
      }
    }
  }

  recursion(this.parsed_body_nodes);

  this.paged_body_nodes = paged_body_nodes;

  this.total_rownum = counter;
};

/**
 * 使用初始化时的参数创建分页页面。必须在初始化后调用
 */
TableBuilder.prototype.build_page = function(page_size, current_page) {
  this.opts.page_size = page_size;
  this.opts.current_page = current_page;

  this._deal_with_paging();

  // 生成主栏
  if (this.opts.indent_model) {
    this.table_body = this._create_table_body_indent();
  } else {
    this.table_body = this._create_table_body();
  }

  // 填充表体
  this._fill_table_body();

  // 表头表体拼到一起
  this._put_together();

  return this;
};

/**
 * 处理数字型出现在主栏的情况
 */
TableBuilder.prototype._deal_with_num_in_row = function() {
  //parse_body_nodes 后方可得知 has_num_in_row、has_dic_in_row、has_label_in_row 是否为真

  if (this.has_num_in_row) {
    // 分组头一定不显示
    this.opts.row_title = "";

    // 若行上不存在任何分组，则强制不显示代码
    if (!this.has_dic_in_row) {
      this.opts.show_code = false;
    }
  }
};

/**
 * 获取行
 * @param row_index 行序号。0开始
 */
TableBuilder.prototype.get_row = function(row_index) {
  return this.table.tbody.rows[row_index];
};

/**
 * 获取列
 * @param col_index 列序号。0开始
 */
TableBuilder.prototype.get_col = function(col_index) {
  var cells = [];
  var rows = this.table.tbody.rows;
  for (var i = 0; i < rows.length; i++) {
    var row = rows[i];
    if (row) {
      for (var j = 0; j < row.cells.length; j++) {
        var cell = row.cells[j];
        if (cell && cell.attrs.col_index == col_index) {
          cells.push(cell);
          break;
        }
      }
    }
  }
  return cells;
};

/**
 * 获取单元格
 * @param row_index 行序号。0开始
 * @param col_index 列序号。0开始
 */
TableBuilder.prototype.get_cell = function(row_index, col_index) {
  var row = this.get_row(row_index);
  if (row) {
    for (var i = 0; i < row.cells.length; i++) {
      var cell = row.cells[i];
      if (cell && cell.attrs.col_index == col_index) {
        return cell;
      }
    }
  }
};

/**
 * 获取单元格
 * @param row_index 行序号。0开始
 * @param col_index 列序号。0开始
 */
TableBuilder.prototype.get_cell_by_key = function(cell_key) {
  return this._col_key_to_cell[cell_key];
};

/**
 * 加载 Map 形式的数据
 * @param {*} data
 */
TableBuilder.prototype.load_data = function(data) {
  if (!data) {
    return;
  }
  for (var key in data) {
    var cell = this.get_cell_by_key(key);
    if (cell) {
      var value = data[key] || "";
      cell.text = value;
    }
  }
};
/*------------------------------------------ TableBuilder instance end ----------------------------------------------*/

export default TableBuilder;
