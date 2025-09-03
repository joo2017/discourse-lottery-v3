export function setup(helper) {
  // 告诉Discourse："当你看到[lottery]标记时，要把它转换成漂亮的HTML"
  helper.registerPlugin(md => {
    md.block.bbcode.ruler.push("lottery", {
      tag: "lottery",
      wrap: function(token, info) {
        // 这里告诉Discourse：把[lottery]内容包装成什么样的HTML
        token.type = "div_open";
        token.tag = "div"; 
        token.attrs = [["class", "lottery-display-card"]];
        return true;
      }
    });
  });

  // 把自定义的HTML类名加入白名单（否则会被删除）
  helper.allowList([
    'div.lottery-display-card',
    'div.lottery-header',
    'div.lottery-content'
  ]);
}
