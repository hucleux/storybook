import { document } from 'global';
import React, { PureComponent, Fragment } from 'react';
import PropTypes from 'prop-types';
import memoize from 'memoizerific';

import {
  createId,
  prevent,
  keyEventToAction,
  getParent,
  getParents,
  getPrevious,
  getMains,
  getNext,
  toFiltered,
} from './utils';

import {
  DefaultSection,
  DefaultList,
  DefaultLink,
  DefaultLeaf,
  DefaultHead,
  DefaultRootTitle,
  DefaultFilter,
  DefaultMessage,
} from './components';

const createHandler = memoize(10000)((item, cb) => (...args) => cb(...args, item));

const linked = (C, { onClick, onKeyUp, prefix = '', Link: L }) => {
  const Linked = React.memo(p => (
    <L
      prefix={prefix}
      {...p}
      onKeyUp={createHandler(p, onKeyUp)}
      onClick={createHandler(p, onClick)}
    >
      <C {...p} />
    </L>
  ));
  Linked.displayName = `Linked${C.displayName}`;

  return Linked;
};

const getLink = memoize(1)(Link => Link || DefaultLink);

const getHead = memoize(1)((Head, Link, prefix, events) =>
  linked(Head || DefaultHead, {
    onClick: events.onClick,
    onKeyUp: events.onKeyUp,
    prefix,
    Link: getLink(Link),
  })
);

const getLeaf = memoize(1)((Leaf, Link, prefix, events) =>
  linked(Leaf || DefaultLeaf, {
    onClick: events.onClick,
    onKeyUp: events.onKeyUp,
    prefix,
    Link: getLink(Link),
  })
);

const getFilter = memoize(1)(Filter => Filter || DefaultFilter);
const getTitle = memoize(1)(Title => Title || DefaultRootTitle);
const getContainer = memoize(1)(Section => Section || DefaultSection);
const getMessage = memoize(1)(Message => Message || DefaultMessage);

const branchOrLeaf = (
  // eslint-disable-next-line react/prop-types
  { Branch, Leaf, Head, List },
  { root, dataset, expanded, selected, depth }
) => {
  const node = dataset[root];
  return node.children ? (
    <Branch
      key={node.id}
      {...{
        Branch,
        Leaf,
        Head,
        List,
        dataset,
        root,
        depth,
        expanded,
        selected,
      }}
    />
  ) : (
    <Leaf key={node.id} {...node} depth={depth} isSelected={selected[node.id]} />
  );
};

const Tree = props => {
  const {
    root,
    depth,
    dataset,
    expanded,
    selected,
    Branch = Tree,
    List = DefaultList,
    Leaf = DefaultLeaf,
    Head = DefaultHead,
  } = props;
  const { children, ...node } = dataset[root] || {};

  const mapNode = i =>
    branchOrLeaf(
      { Branch, Leaf, Head, List },
      { dataset, selected, expanded, root: i, depth: depth + 1 }
    );

  switch (true) {
    case !!(children && children.length && node.name): {
      return (
        <Fragment>
          <Head
            {...node}
            depth={depth}
            isExpanded={expanded[node.id]}
            isSelected={selected[node.id]}
          />
          {children && expanded[node.id] ? <List>{children.map(mapNode)}</List> : null}
        </Fragment>
      );
    }
    case !!(children && children.length): {
      return <List>{children.map(mapNode)}</List>;
    }
    default: {
      return null;
    }
  }
};

const calculateTreeState = memoize(50)(({ dataset, filter, selectedId }) => {
  const filteredDataset = filter ? toFiltered(dataset, filter) : dataset;

  const selected = Object.keys(filteredDataset).reduce(
    (acc, k) => Object.assign(acc, { [k]: k === selectedId }),
    {}
  );

  const selectedAncestorIds = selectedId
    ? getParents(selectedId, filteredDataset).map(i => i.id)
    : [];

  const expanded = Object.keys(filteredDataset).reduce(
    (acc, key) => ({
      ...acc,
      [key]: selectedAncestorIds.includes(key),
    }),
    {}
  );

  const { roots, others } = getMains(filteredDataset).reduce(
    (acc, item) => {
      const { isRoot } = item;
      return isRoot
        ? { ...acc, roots: [...acc.roots, item] }
        : { ...acc, others: [...acc.others, item] };
    },
    { roots: [], others: [] }
  );

  return { filteredDataset, selected, expanded, roots, others };
});

// eslint-disable-next-line react/no-multi-comp
class ControlledTreeState extends PureComponent {
  // Initial state is not important
  state = {};

  static getDerivedStateFromProps({ dataset, selectedId, filter }) {
    console.log({ dataset, selectedId, filter });
    return calculateTreeState({ dataset, selectedId, filter });
  }

  events = {
    onClick: (e, item) => {
      const { expanded } = this.state;
      this.setState({
        expanded: {
          ...expanded,
          [item.id]: !expanded[item.id],
        },
      });
    },
    onKeyUp: (e, item) => {
      const { prefix } = this.props;
      const { expanded, filteredDataset } = this.state;

      const action = keyEventToAction(e);
      if (action) {
        prevent(e);
      }

      if (action === 'RIGHT') {
        const next = getNext({ id: item.id, filteredDataset, expanded });
        if (!filteredDataset[item.id].children || expanded[item.id]) {
          if (next) {
            try {
              document.getElementById(createId(next.id, prefix)).focus();
            } catch (err) {
              // debugger;
            }
          }
        }

        this.setState({ expanded: { ...expanded, [item.id]: true } });
      }
      if (action === 'LEFT') {
        const prev = getPrevious({ id: item.id, filteredDataset, expanded });

        if (!filteredDataset[item.id].children || !expanded[item.id]) {
          const parent = getParent(item.id, filteredDataset);
          if (parent && parent.children) {
            try {
              document.getElementById(createId(parent.id, prefix)).focus();
            } catch (err) {
              // debugger;
            }

            if (prev) {
              try {
                document.getElementById(createId(prev.id, prefix)).focus();
              } catch (err) {
                // debugger;
              }
            }
          }
        }

        this.setState({ expanded: { ...expanded, [item.id]: false } });
      }
      if (action === 'DOWN') {
        const next = getNext({ id: item.id, filteredDataset, expanded });
        if (next) {
          try {
            document.getElementById(createId(next.id, prefix)).focus();
          } catch (err) {
            // debugger;
          }
        }
      }
      if (action === 'UP') {
        const prev = getPrevious({ id: item.id, filteredDataset, expanded });

        if (prev) {
          try {
            document.getElementById(createId(prev.id, prefix)).focus();
          } catch (err) {
            // debugger;
          }
        }
      }
    },
  };

  render() {
    const {
      events,
      state: { filteredDataset, selected, expanded, roots, others },
      props,
    } = this;
    const { prefix } = props;

    const Filter = getFilter(props.Filter);
    const List = getFilter(props.List);
    const Branch = Tree;
    const Title = getTitle(props.Title);
    const Link = getLink(props.Link);
    const Leaf = getLeaf(props.Leaf, Link, prefix, events);
    const Head = getHead(props.Head, Link, prefix, events);
    const Section = getContainer(props.Section);
    const Message = getMessage(props.Message);

    return (
      <Fragment>
        {Filter ? <Filter key="filter" onChange={this.events.onFilter} /> : null}
        {roots.length || others.length ? (
          <Fragment>
            {roots.map(({ id, name, children }) => (
              <Section key={id}>
                <Title type="section" mods={['uppercase']}>
                  {name}
                </Title>
                {children.map(key => (
                  <Branch
                    key={key}
                    depth={0}
                    dataset={filteredDataset}
                    selected={selected}
                    expanded={expanded}
                    root={key}
                    events={events}
                    Head={Head}
                    Leaf={Leaf}
                    Branch={Branch}
                    List={List}
                  />
                ))}
              </Section>
            ))}
            {others.length ? (
              <Section key="other">
                {roots.length ? (
                  <Title type="section" mods={['uppercase']}>
                    Others
                  </Title>
                ) : null}
                {others.map(({ id }) => (
                  <Branch
                    key={id}
                    depth={0}
                    dataset={filteredDataset}
                    selected={selected}
                    expanded={expanded}
                    root={id}
                    events={events}
                    Link={Link}
                    Head={Head}
                    Leaf={Leaf}
                    Branch={Branch}
                  />
                ))}
              </Section>
            ) : null}
          </Fragment>
        ) : (
          <Message>This filter resulted in 0 results</Message>
        )}
      </Fragment>
    );
  }
}

ControlledTreeState.propTypes = {
  prefix: PropTypes.string.isRequired,
  dataset: PropTypes.shape({}).isRequired,
  selectedId: PropTypes.string,
  filter: PropTypes.string.isRequired,
};

ControlledTreeState.defaultProps = {
  selectedId: null,
};

// eslint-disable-next-line react/no-multi-comp
class TreeState extends PureComponent {
  state = { filter: '' };

  onFilter(filter) {
    this.setState({ filter });
  }

  render() {
    const { filter } = this.state;
    return <ControlledTreeState filter={filter} {...this.props} onFilter={this.onFilter} />;
  }
}

TreeState.propTypes = {
  prefix: PropTypes.string.isRequired,
  dataset: PropTypes.shape({}).isRequired,
  selectedId: PropTypes.string,
};
TreeState.defaultProps = {
  selectedId: null,
};

export { TreeState, ControlledTreeState, Tree };
