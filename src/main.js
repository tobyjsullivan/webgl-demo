const REGEX_LENGTH_ZERO = /^0$/;
const REGEX_LENGTH_PIXELS = /^(\d)+px$/;
const REGEX_LENGTH_PERCENT = /^(\d)+\%$/;

const len = (relative, measure) => {
  if (REGEX_LENGTH_ZERO.test(measure)) {
    return 0;
  }

  if (REGEX_LENGTH_PIXELS.test(measure)) {
    const [strPixels] = REGEX_LENGTH_PIXELS.exec(measure);
    const pixels = parseInt(strPixels);
    return pixels;
  }

  if (REGEX_LENGTH_PERCENT.test(measure)) {
    const [strPercent] = REGEX_LENGTH_PERCENT.exec(measure);
    const percent = parseFloat(strPercent);

    const result = Math.round((relative * percent) / 100);
    return result;
  }

  throw new Error(`Unsupported length value: ${measure}`);
};

class RenderNode {
  constructor(props) {
    this.props = props;
  }

  render(two) {
    throw new Error("Not implemented");
  }
}

class RectangleRenderNode extends RenderNode {
  constructor(props) {
    super(props);
  }

  render(two) {
    const { x, y, width, height, fill, children } = this.props;

    console.info(`[Rectangle::render]`, { x, y, width, height });

    const centerX = width / 2 + x;
    const centerY = height / 2 + y;

    // TODO: May need to translate from pixels to units (not sure)
    const rect = two.makeRectangle(centerX, centerY, width, height);
    rect.fill = fill;
    rect.stroke = "none";

    for (const child of children) {
      child.render(two);
    }
  }
}

// Container simply holds children and is not rendered
class ContainerRenderNode extends RenderNode {
  constructor(props) {
    super(props);
  }

  render(two) {
    const { children } = this.props;

    for (const child of children) {
      child.render(two);
    }
  }
}

class CanvasNode {
  constructor(props) {
    this.props = props;
  }
}

class CanvasRectangleNode extends CanvasNode {
  constructor(props) {
    super(props);
    console.info(`[CanvasRectangleNode] props:`, props);

    this.type = "rectangle";
  }

  toRenderNodes(context) {
    console.info(
      `[CanvasRectangleNode::toRenderNodes] this.props:`,
      this.props,
      `context:`,
      context
    );

    const {
      parent: {
        x: parentX,
        y: parentY,
        width: parentWidth,
        height: parentHeight,
      },
    } = context;
    const { key, left, top, width, height, background, padding, children } =
      this.props;

    const { color: backgroundColor } = background;
    const {
      left: paddingLeft,
      top: paddingTop,
      right: paddingRight,
      bottom: paddingBottom,
    } = padding;

    const x = parentX + (left ? len(parentWidth, left) : 0);
    const y = parentY + (top ? len(parentHeight, top) : 0);
    let w = len(parentWidth, width);
    let h = len(parentHeight, height);

    console.info(`[toRenderNodes]`, { key, parentWidth, w });

    let contentLeft = x + (paddingLeft ? len(parentWidth, paddingLeft) : 0);
    let contentTop = y + (paddingTop ? len(parentHeight, paddingTop) : 0);
    let contentRight =
      x + w - (paddingRight ? len(parentWidth, paddingRight) : 0);
    let contentBottom =
      y + h - (paddingBottom ? len(parentHeight, paddingBottom) : 0);

    let contentHeight = contentBottom - contentTop;
    let contentWidth = contentRight - contentLeft;

    let childRenderNodes = [];
    for (const child of children) {
      const { nodes, boundingBox } = child.toRenderNodes({
        parent: {
          x: contentLeft,
          y: contentTop,
          width: contentWidth,
          height: contentHeight,
        },
      });

      childRenderNodes.push(...nodes);

      // Every item is below the previous (block mode)
      contentTop = boundingBox.y + boundingBox.height;

      // Expand the parent height as needed to fit children
      contentBottom = Math.max(contentBottom, contentTop);
    }
    contentHeight = contentTop - y;
    h = Math.max(
      h,
      contentHeight + (paddingBottom ? len(parentHeight, paddingBottom) : 0)
    );

    console.info(`[toRenderNodes]`, { key, x, y, w, h });

    return {
      nodes: [
        new RectangleRenderNode({
          x,
          y,
          width: w,
          height: h,
          fill: backgroundColor,
          children: childRenderNodes,
        }),
      ],
      boundingBox: {
        x,
        y,
        width: w,
        height: h,
      },
    };
  }
}

function toCanvasNode(obj) {
  const { type, props, children } = obj;
  if (type !== "rect") {
    // TODO: Support more node types
    throw new Error(`Unsupported node type: ${type}`);
  }

  const childNodes = children.map((child) => toCanvasNode(child));

  return new CanvasRectangleNode({ ...props, children: childNodes });
}

function render(two, scene) {
  console.time("refresh");

  console.time("parse");
  const canvasTree = toCanvasNode(scene);
  console.timeEnd("parse");
  console.info(`[render] canvasTree:`, canvasTree);

  const context = {
    parent: {
      x: 0,
      y: 0,
      width: two.width,
      height: two.height,
    },
  };
  console.time("layout");
  const { nodes } = canvasTree.toRenderNodes(context);
  console.timeEnd("layout");
  const renderTree = new ContainerRenderNode({ children: nodes });
  console.info(`[render] renderTree:`, renderTree);

  console.time("render");
  renderTree.render(two);
  console.timeEnd("render");

  console.time("paint");
  two.update();
  console.timeEnd("paint");
  console.timeEnd("refresh");
}

function main() {
  const $root = document.getElementById("root");

  // $root.innerHTML = `<p>Hello world!</p>`;

  const scene = {
    type: "rect",
    props: {
      key: "parent",
      left: "20%",
      top: "10%",
      width: "50%",
      height: "50%",
      background: {
        color: "#FF8000",
      },
      padding: {
        left: "20px",
        top: "10px",
        right: "20px",
        bottom: "10px",
      },
    },
    children: [
      {
        type: "rect",
        props: {
          key: "childA",
          left: "0",
          top: "0",
          width: "100%",
          height: "100%",
          background: {
            color: "#FFFFFF",
          },
          padding: {},
        },
        children: [],
      },
      {
        type: "rect",
        props: {
          key: "childB",
          left: "0",
          top: "15px",
          width: "50%",
          height: "50%",
          background: {
            color: "#FFFFFF",
          },
          padding: {},
        },
        children: [],
      },
    ],
  };

  const params = { fullscreen: true, type: "WebGLRenderer" };
  const two = new Two(params).appendTo($root);

  render(two, scene);
}

main();
