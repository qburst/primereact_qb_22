import * as React from 'react';
import PrimeReact, { FilterService, PrimeReactContext } from '../api/Api';
import { useHandleStyle } from '../componentbase/ComponentBase';
import { useMountEffect, useOverlayListener, useUnmountEffect, useUpdateEffect } from '../hooks/Hooks';
import { ChevronDownIcon } from '../icons/chevrondown';
import { SpinnerIcon } from '../icons/spinner';
import { TimesIcon } from '../icons/times';
import { OverlayService } from '../overlayservice/OverlayService';
import { Tooltip } from '../tooltip/Tooltip';
import { DomHandler, IconUtils, ObjectUtils, ZIndexUtils, classNames, mergeProps } from '../utils/Utils';
import { DropdownBase } from './DropdownBase';
import { DropdownPanel } from './DropdownPanel';

export const Dropdown = React.memo(
    React.forwardRef((inProps, ref) => {
        const context = React.useContext(PrimeReactContext);
        const props = DropdownBase.getProps(inProps, context);
        const [filterState, setFilterState] = React.useState('');
        const [focusedState, setFocusedState] = React.useState(false);
        const [overlayVisibleState, setOverlayVisibleState] = React.useState(false);
        const elementRef = React.useRef(null);
        const overlayRef = React.useRef(null);
        const inputRef = React.useRef(props.inputRef);
        const focusInputRef = React.useRef(props.focusInputRef);
        const virtualScrollerRef = React.useRef(null);
        const searchTimeout = React.useRef(null);
        const searchValue = React.useRef(null);
        const currentSearchChar = React.useRef(null);
        const isLazy = props.virtualScrollerOptions && props.virtualScrollerOptions.lazy;
        const hasFilter = ObjectUtils.isNotEmpty(filterState);
        const appendTo = props.appendTo || (context && context.appendTo) || PrimeReact.appendTo;
        const { ptm, cx, sx, isUnstyled } = DropdownBase.setMetaData({
            props,
            ...props.__parentMetadata,
            state: {
                filter: filterState,
                focused: focusedState,
                overlayVisible: overlayVisibleState
            }
        });

        useHandleStyle(DropdownBase.css.styles, isUnstyled, { name: 'dropdown' });

        const [bindOverlayListener, unbindOverlayListener] = useOverlayListener({
            target: elementRef,
            overlay: overlayRef,
            listener: (event, { type, valid }) => {
                if (valid) {
                    type === 'outside' ? !isClearClicked(event) && hide() : hide();
                }
            },
            when: overlayVisibleState
        });

        const getVisibleOptions = () => {
            if (hasFilter && !isLazy) {
                const filterValue = filterState.trim().toLocaleLowerCase(props.filterLocale);
                const searchFields = props.filterBy ? props.filterBy.split(',') : [props.optionLabel || 'label'];

                if (props.optionGroupLabel) {
                    let filteredGroups = [];

                    for (let optgroup of props.options) {
                        let filteredSubOptions = FilterService.filter(getOptionGroupChildren(optgroup), searchFields, filterValue, props.filterMatchMode, props.filterLocale);

                        if (filteredSubOptions && filteredSubOptions.length) {
                            filteredGroups.push({ ...optgroup, ...{ [`${props.optionGroupChildren}`]: filteredSubOptions } });
                        }
                    }

                    return filteredGroups;
                } else {
                    return FilterService.filter(props.options, searchFields, filterValue, props.filterMatchMode, props.filterLocale);
                }
            } else {
                return props.options;
            }
        };

        const isClearClicked = (event) => {
            return DomHandler.isAttributeEquals(event.target, 'data-pc-section', 'clearicon') || DomHandler.isAttributeEquals(event.target.parentElement || event.target, 'data-pc-section', 'filterclearicon');
        };

        const onClick = (event) => {
            if (props.disabled || props.loading) {
                return;
            }

            props.onClick && props.onClick(event);

            // do not continue if the user defined click wants to prevent it
            if (event.defaultPrevented) {
                return;
            }

            if (isClearClicked(event) || event.target.tagName === 'INPUT') {
                return;
            } else if (!overlayRef.current || !(overlayRef.current && overlayRef.current.contains(event.target))) {
                DomHandler.focus(focusInputRef.current);
                overlayVisibleState ? hide() : show();
            }
        };

        const onInputFocus = (event) => {
            if (props.showOnFocus && !overlayVisibleState) {
                show();
            }

            setFocusedState(true);
            props.onFocus && props.onFocus(event);
        };

        const onInputBlur = (event) => {
            setFocusedState(false);

            if (props.onBlur) {
                setTimeout(() => {
                    const currentValue = inputRef.current ? inputRef.current.value : undefined;

                    props.onBlur({
                        originalEvent: event.originalEvent,
                        value: currentValue,
                        stopPropagation: () => {
                            event.originalEvent.stopPropagation();
                        },
                        preventDefault: () => {
                            event.originalEvent.preventDefault();
                        },
                        target: {
                            name: props.name,
                            id: props.id,
                            value: currentValue
                        }
                    });
                }, 200);
            }
        };

        const onPanelClick = (event) => {
            OverlayService.emit('overlay-click', {
                originalEvent: event,
                target: elementRef.current
            });
        };

        const onInputKeyDown = (event) => {
            switch (event.which) {
                //down
                case 40:
                    onDownKey(event);
                    break;

                //up
                case 38:
                    onUpKey(event);
                    break;

                //space and enter
                case 32:
                case 13:
                    overlayVisibleState ? hide() : show();
                    event.preventDefault();
                    break;

                //escape and tab
                case 27:
                case 9:
                    hide();
                    break;

                default:
                    search(event);
                    break;
            }
        };

        const onFilterInputKeyDown = (event) => {
            switch (event.which) {
                //down
                case 40:
                    onDownKey(event);
                    break;

                //up
                case 38:
                    onUpKey(event);
                    break;

                //enter and escape
                case 13:
                case 27:
                    hide();
                    event.preventDefault();
                    break;

                default:
                    break;
            }
        };

        const onUpKey = (event) => {
            if (visibleOptions) {
                const prevOption = findPrevOption(getSelectedOptionIndex());

                if (prevOption) {
                    selectItem({
                        originalEvent: event,
                        option: prevOption
                    });
                }
            }

            event.preventDefault();
        };

        const onDownKey = (event) => {
            if (visibleOptions) {
                if (!overlayVisibleState && event.altKey) {
                    show();
                } else {
                    const nextOption = findNextOption(getSelectedOptionIndex());

                    if (nextOption) {
                        selectItem({
                            originalEvent: event,
                            option: nextOption
                        });
                    }
                }
            }

            event.preventDefault();
        };

        const findNextOption = (index) => {
            if (props.optionGroupLabel) {
                const groupIndex = index === -1 ? 0 : index.group;
                const optionIndex = index === -1 ? -1 : index.option;
                const option = findNextOptionInList(getOptionGroupChildren(visibleOptions[groupIndex]), optionIndex);

                if (option) return option;
                else if (groupIndex + 1 !== visibleOptions.length) return findNextOption({ group: groupIndex + 1, option: -1 });
                else return null;
            }

            return findNextOptionInList(visibleOptions, index);
        };

        const findNextOptionInList = (list, index) => {
            const i = index + 1;

            if (i === list.length) {
                return null;
            }

            const option = list[i];

            return isOptionDisabled(option) ? findNextOptionInList(i) : option;
        };

        const findPrevOption = (index) => {
            if (index === -1) {
                return null;
            }

            if (props.optionGroupLabel) {
                const groupIndex = index.group;
                const optionIndex = index.option;
                const option = findPrevOptionInList(getOptionGroupChildren(visibleOptions[groupIndex]), optionIndex);

                if (option) return option;
                else if (groupIndex > 0) return findPrevOption({ group: groupIndex - 1, option: getOptionGroupChildren(visibleOptions[groupIndex - 1]).length });
                else return null;
            }

            return findPrevOptionInList(visibleOptions, index);
        };

        const findPrevOptionInList = (list, index) => {
            const i = index - 1;

            if (i < 0) {
                return null;
            }

            const option = list[i];

            return isOptionDisabled(option) ? findPrevOption(i) : option;
        };

        const search = (event) => {
            if (searchTimeout.current) {
                clearTimeout(searchTimeout.current);
            }

            const char = event.key;

            if (char === 'Shift' || char === 'Control' || char === 'Alt') {
                return;
            }

            if (currentSearchChar.current === char) searchValue.current = char;
            else searchValue.current = searchValue.current ? searchValue.current + char : char;

            currentSearchChar.current = char;

            if (searchValue.current) {
                const searchIndex = getSelectedOptionIndex();
                const newOption = props.optionGroupLabel ? searchOptionInGroup(searchIndex) : searchOption(searchIndex + 1);

                if (newOption) {
                    selectItem({
                        originalEvent: event,
                        option: newOption
                    });
                }
            }

            searchTimeout.current = setTimeout(() => {
                searchValue.current = null;
            }, 250);
        };

        const searchOption = (index) => {
            if (searchValue.current) {
                return searchOptionInRange(index, visibleOptions.length) || searchOptionInRange(0, index);
            }

            return null;
        };

        const searchOptionInRange = (start, end) => {
            for (let i = start; i < end; i++) {
                const opt = visibleOptions[i];

                if (matchesSearchValue(opt)) {
                    return opt;
                }
            }

            return null;
        };

        const searchOptionInGroup = (index) => {
            const searchIndex = index === -1 ? { group: 0, option: -1 } : index;

            for (let i = searchIndex.group; i < visibleOptions.length; i++) {
                let groupOptions = getOptionGroupChildren(visibleOptions[i]);

                for (let j = searchIndex.group === i ? searchIndex.option + 1 : 0; j < groupOptions.length; j++) {
                    if (matchesSearchValue(groupOptions[j])) {
                        return groupOptions[j];
                    }
                }
            }

            for (let i = 0; i <= searchIndex.group; i++) {
                let groupOptions = getOptionGroupChildren(visibleOptions[i]);

                for (let j = 0; j < (searchIndex.group === i ? searchIndex.option : groupOptions.length); j++) {
                    if (matchesSearchValue(groupOptions[j])) {
                        return groupOptions[j];
                    }
                }
            }

            return null;
        };

        const matchesSearchValue = (option) => {
            let label = getOptionLabel(option);

            if (!label) {
                return false;
            }

            label = label.toLocaleLowerCase(props.filterLocale);

            return label.startsWith(searchValue.current.toLocaleLowerCase(props.filterLocale));
        };

        const onEditableInputChange = (event) => {
            if (props.onChange) {
                props.onChange({
                    originalEvent: event.originalEvent,
                    value: event.target.value,
                    stopPropagation: () => {
                        event.originalEvent.stopPropagation();
                    },
                    preventDefault: () => {
                        event.originalEvent.preventDefault();
                    },
                    target: {
                        name: props.name,
                        id: props.id,
                        value: event.target.value
                    }
                });
            }
        };

        const onEditableInputFocus = (event) => {
            setFocusedState(true);
            hide();
            props.onFocus && props.onFocus(event);
        };

        const onOptionClick = (event) => {
            const option = event.option;

            if (!option.disabled) {
                selectItem(event);
                DomHandler.focus(focusInputRef.current);
            }

            hide();
        };

        const onFilterInputChange = (event) => {
            const filter = event.target.value;

            setFilterState(filter);

            if (props.onFilter) {
                props.onFilter({
                    originalEvent: event,
                    filter
                });
            }
        };

        const onFilterClearIconClick = (callback) => {
            resetFilter(callback);
        };

        const resetFilter = (callback) => {
            setFilterState('');
            props.onFilter && props.onFilter({ filter: '' });
            callback && callback();
        };

        const clear = (event) => {
            if (props.onChange) {
                props.onChange({
                    originalEvent: event,
                    value: undefined,
                    stopPropagation: () => {
                        event.stopPropagation();
                    },
                    preventDefault: () => {
                        event.preventDefault();
                    },
                    target: {
                        name: props.name,
                        id: props.id,
                        value: undefined
                    }
                });
            }
            
            if (props.filter) {
                resetFilter();
            }

            updateEditableLabel();
        };

        const selectItem = (event) => {
            if (selectedOption !== event.option) {
                updateEditableLabel(event.option);
                const optionValue = getOptionValue(event.option);

                if (props.onChange) {
                    props.onChange({
                        originalEvent: event.originalEvent,
                        value: optionValue,
                        stopPropagation: () => {
                            event.originalEvent.stopPropagation();
                        },
                        preventDefault: () => {
                            event.originalEvent.preventDefault();
                        },
                        target: {
                            name: props.name,
                            id: props.id,
                            value: optionValue
                        }
                    });
                }
            }
        };

        const getSelectedOptionIndex = (options) => {
            options = options || visibleOptions;

            if (props.value != null && options) {
                if (props.optionGroupLabel) {
                    for (let i = 0; i < options.length; i++) {
                        let selectedOptionIndex = findOptionIndexInList(props.value, getOptionGroupChildren(options[i]));

                        if (selectedOptionIndex !== -1) {
                            return { group: i, option: selectedOptionIndex };
                        }
                    }
                } else {
                    return findOptionIndexInList(props.value, options);
                }
            }

            return -1;
        };

        const equalityKey = () => {
            return props.optionValue ? null : props.dataKey;
        };

        const findOptionIndexInList = (value, list) => {
            const key = equalityKey();

            return list.findIndex((item) => ObjectUtils.equals(value, getOptionValue(item), key));
        };

        const isSelected = (option) => {
            return ObjectUtils.equals(props.value, getOptionValue(option), equalityKey());
        };

        const show = () => {
            setOverlayVisibleState(true);
        };

        const hide = () => {
            setOverlayVisibleState(false);
        };

        const onOverlayEnter = (callback) => {
            ZIndexUtils.set('overlay', overlayRef.current, (context && context.autoZIndex) || PrimeReact.autoZIndex, (context && context.zIndex['overlay']) || PrimeReact.zIndex['overlay']);
            DomHandler.addStyles(overlayRef.current, { position: 'absolute', top: '0', left: '0' });
            alignOverlay();
            callback && callback();
        };

        const onOverlayEntered = (callback) => {
            callback && callback();
            bindOverlayListener();

            props.onShow && props.onShow();
        };

        const onOverlayExit = () => {
            unbindOverlayListener();
        };

        const onOverlayExited = () => {
            if (props.filter && props.resetFilterOnHide) {
                resetFilter();
            }

            ZIndexUtils.clear(overlayRef.current);

            props.onHide && props.onHide();
        };

        const alignOverlay = () => {
            DomHandler.alignOverlay(overlayRef.current, inputRef.current.parentElement, props.appendTo || (context && context.appendTo) || PrimeReact.appendTo);
        };

        const scrollInView = () => {
            const highlightItem = DomHandler.findSingle(overlayRef.current, 'li[data-p-highlight="true"]');

            if (highlightItem && highlightItem.scrollIntoView) {
                highlightItem.scrollIntoView({ block: 'nearest', inline: 'nearest' });
            }
        };

        const updateEditableLabel = (option) => {
            if (inputRef.current) {
                inputRef.current.value = option ? getOptionLabel(option) : props.value || '';
            }
        };

        const getOptionLabel = (option) => {
            return props.optionLabel ? ObjectUtils.resolveFieldData(option, props.optionLabel) : option && option['label'] !== undefined ? option['label'] : option;
        };

        const getOptionValue = (option) => {
            return props.optionValue ? ObjectUtils.resolveFieldData(option, props.optionValue) : option && option['value'] !== undefined ? option['value'] : option;
        };

        const getOptionRenderKey = (option) => {
            return props.dataKey ? ObjectUtils.resolveFieldData(option, props.dataKey) : getOptionLabel(option);
        };

        const isOptionDisabled = (option) => {
            if (props.optionDisabled) {
                return ObjectUtils.isFunction(props.optionDisabled) ? props.optionDisabled(option) : ObjectUtils.resolveFieldData(option, props.optionDisabled);
            }

            return option && option['disabled'] !== undefined ? option['disabled'] : false;
        };

        const getOptionGroupRenderKey = (optionGroup) => {
            return ObjectUtils.resolveFieldData(optionGroup, props.optionGroupLabel);
        };

        const getOptionGroupLabel = (optionGroup) => {
            return ObjectUtils.resolveFieldData(optionGroup, props.optionGroupLabel);
        };

        const getOptionGroupChildren = (optionGroup) => {
            return ObjectUtils.resolveFieldData(optionGroup, props.optionGroupChildren);
        };

        const updateInputField = () => {
            if (props.editable && inputRef.current) {
                const label = selectedOption ? getOptionLabel(selectedOption) : null;
                const value = label || props.value || '';

                inputRef.current.value = value;
            }
        };

        const getSelectedOption = () => {
            const index = getSelectedOptionIndex(props.options);

            return index !== -1 ? (props.optionGroupLabel ? getOptionGroupChildren(props.options[index.group])[index.option] : props.options[index]) : null;
        };

        React.useImperativeHandle(ref, () => ({
            props,
            show,
            hide,
            clear,
            focus: () => DomHandler.focus(focusInputRef.current),
            getElement: () => elementRef.current,
            getOverlay: () => overlayRef.current,
            getInput: () => inputRef.current,
            getFocusInput: () => focusInputRef.current,
            getVirtualScroller: () => virtualScrollerRef.current
        }));

        React.useEffect(() => {
            ObjectUtils.combinedRefs(inputRef, props.inputRef);
            ObjectUtils.combinedRefs(focusInputRef, props.focusInputRef);
        }, [inputRef, props.inputRef, focusInputRef, props.focusInputRef]);

        useMountEffect(() => {
            if (props.autoFocus) {
                DomHandler.focus(focusInputRef.current, props.autoFocus);
            }

            alignOverlay();
        });

        useUpdateEffect(() => {
            if (overlayVisibleState && props.value) {
                scrollInView();
            }
        }, [overlayVisibleState, props.value]);

        useUpdateEffect(() => {
            if (overlayVisibleState && filterState && props.filter) {
                alignOverlay();
            }
        }, [overlayVisibleState, filterState, props.filter]);

        useUpdateEffect(() => {
            if (filterState && (!props.options || props.options.length === 0)) {
                setFilterState('');
            }

            updateInputField();

            if (inputRef.current) {
                inputRef.current.selectedIndex = 1;
            }
        });

        useUnmountEffect(() => {
            ZIndexUtils.clear(overlayRef.current);
        });

        const createHiddenSelect = () => {
            let option = { value: '', label: props.placeholder };

            if (selectedOption) {
                const optionValue = getOptionValue(selectedOption);

                option = {
                    value: typeof optionValue === 'object' ? props.options.findIndex((o) => o === optionValue) : optionValue,
                    label: getOptionLabel(selectedOption)
                };
            }

            const hiddenSelectedMessageProps = mergeProps(
                {
                    className: 'p-hidden-accessible p-dropdown-hidden-select'
                },
                ptm('hiddenSelectedMessage')
            );

            const selectProps = mergeProps(
                {
                    ref: inputRef,
                    required: props.required,
                    defaultValue: option.value,
                    name: props.name,
                    tabIndex: -1,
                    'aria-hidden': 'true'
                },
                ptm('select')
            );

            const optionProps = mergeProps(
                {
                    value: option.value
                },
                ptm('option')
            );

            return (
                <div {...hiddenSelectedMessageProps}>
                    <select {...selectProps}>
                        <option {...optionProps}>{option.label}</option>
                    </select>
                </div>
            );
        };

        const createKeyboardHelper = () => {
            const hiddenSelectedMessageProps = mergeProps(
                {
                    className: 'p-hidden-accessible'
                },
                ptm('hiddenSelectedMessage')
            );

            const inputProps = mergeProps(
                {
                    ref: focusInputRef,
                    id: props.inputId,
                    type: 'text',
                    readOnly: true,
                    'aria-haspopup': 'listbox',
                    onFocus: onInputFocus,
                    onBlur: onInputBlur,
                    onKeyDown: onInputKeyDown,
                    disabled: props.disabled,
                    tabIndex: props.tabIndex || 0,
                    ...ariaProps
                },
                ptm('input')
            );

            return (
                <div {...hiddenSelectedMessageProps}>
                    <input {...inputProps} />
                </div>
            );
        };

        const createLabel = () => {
            const label = ObjectUtils.isNotEmpty(selectedOption) ? getOptionLabel(selectedOption) : null;

            if (props.editable) {
                const value = label || props.value || '';
                const inputProps = mergeProps(
                    {
                        ref: inputRef,
                        type: 'text',
                        defaultValue: value,
                        className: cx('input', { label }),
                        disabled: props.disabled,
                        placeholder: props.placeholder,
                        maxLength: props.maxLength,
                        onInput: onEditableInputChange,
                        onFocus: onEditableInputFocus,
                        onBlur: onInputBlur,
                        tabIndex: props.tabIndex || 0,
                        'aria-haspopup': 'listbox',
                        ...ariaProps
                    },
                    ptm('input')
                );

                return <input {...inputProps} />;
            } else {
                const content = props.valueTemplate ? ObjectUtils.getJSXElement(props.valueTemplate, selectedOption, props) : label || props.placeholder || 'empty';
                const inputProps = mergeProps(
                    {
                        ref: inputRef,
                        className: cx('input', { label }),
                        tabIndex: '-1'
                    },
                    ptm('input')
                );

                return <span {...inputProps}>{content}</span>;
            }
        };

        const createClearIcon = () => {
            if (props.value != null && props.showClear && !props.disabled) {
                const clearIconProps = mergeProps(
                    {
                        className: cx('clearIcon'),
                        onPointerUp: clear
                    },
                    ptm('clearIcon')
                );
                const icon = props.clearIcon || <TimesIcon {...clearIconProps} />;

                return IconUtils.getJSXIcon(icon, { ...clearIconProps }, { props });
            }

            return null;
        };

        const createLoadingIcon = () => {
            const loadingIconProps = mergeProps(
                {
                    className: cx('loadingIcon'),
                    'data-pr-overlay-visible': overlayVisibleState
                },
                ptm('loadingIcon')
            );
            const icon = props.loadingIcon || <SpinnerIcon spin />;
            const loadingIcon = IconUtils.getJSXIcon(icon, { ...loadingIconProps }, { props });
            const ariaLabel = props.placeholder || props.ariaLabel;
            const loadingButtonProps = mergeProps(
                {
                    className: cx('trigger'),
                    role: 'button',
                    'aria-haspopup': 'listbox',
                    'aria-expanded': overlayVisibleState,
                    'aria-label': ariaLabel
                },
                ptm('trigger')
            );

            return <div {...loadingButtonProps}>{loadingIcon}</div>;
        };

        const createDropdownIcon = () => {
            const dropdownIconProps = mergeProps(
                {
                    className: cx('dropdownIcon'),
                    'data-pr-overlay-visible': overlayVisibleState
                },
                ptm('dropdownIcon')
            );
            const icon = props.dropdownIcon || <ChevronDownIcon {...dropdownIconProps} />;
            const dropdownIcon = IconUtils.getJSXIcon(icon, { ...dropdownIconProps }, { props });

            const ariaLabel = props.placeholder || props.ariaLabel;
            const triggerProps = mergeProps(
                {
                    className: cx('trigger'),
                    role: 'button',
                    'aria-haspopup': 'listbox',
                    'aria-expanded': overlayVisibleState,
                    'aria-label': ariaLabel
                },
                ptm('trigger')
            );

            return <div {...triggerProps}>{dropdownIcon}</div>;
        };

        const visibleOptions = getVisibleOptions();
        const selectedOption = getSelectedOption();

        const hasTooltip = ObjectUtils.isNotEmpty(props.tooltip);
        const otherProps = DropdownBase.getOtherProps(props);
        const ariaProps = ObjectUtils.reduceKeys(otherProps, DomHandler.ARIA_PROPS);
        const hiddenSelect = createHiddenSelect();
        const keyboardHelper = createKeyboardHelper();
        const labelElement = createLabel();
        const dropdownIcon = props.loading ? createLoadingIcon() : createDropdownIcon();
        const clearIcon = createClearIcon();
        const rootProps = mergeProps(
            {
                id: props.id,
                ref: elementRef,
                className: classNames(props.className, cx('root', { focusedState, overlayVisibleState })),
                style: props.style,
                onClick: (e) => onClick(e),
                onMouseDown: props.onMouseDown,
                onContextMenu: props.onContextMenu,
                'data-p-disabled': props.disabled,
                'data-p-focus': focusedState
            },
            otherProps,
            ptm('root')
        );

        return (
            <>
                <div {...rootProps}>
                    {keyboardHelper}
                    {hiddenSelect}
                    {labelElement}
                    {clearIcon}
                    {dropdownIcon}
                    <DropdownPanel
                        hostName="Dropdown"
                        ref={overlayRef}
                        visibleOptions={visibleOptions}
                        virtualScrollerRef={virtualScrollerRef}
                        {...props}
                        appendTo={appendTo}
                        onClick={onPanelClick}
                        onOptionClick={onOptionClick}
                        filterValue={filterState}
                        hasFilter={hasFilter}
                        onFilterClearIconClick={onFilterClearIconClick}
                        resetFilter={resetFilter}
                        onFilterInputKeyDown={onFilterInputKeyDown}
                        onFilterInputChange={onFilterInputChange}
                        getOptionLabel={getOptionLabel}
                        getOptionRenderKey={getOptionRenderKey}
                        isOptionDisabled={isOptionDisabled}
                        getOptionGroupChildren={getOptionGroupChildren}
                        getOptionGroupLabel={getOptionGroupLabel}
                        getOptionGroupRenderKey={getOptionGroupRenderKey}
                        isSelected={isSelected}
                        getSelectedOptionIndex={getSelectedOptionIndex}
                        in={overlayVisibleState}
                        onEnter={onOverlayEnter}
                        onEntered={onOverlayEntered}
                        onExit={onOverlayExit}
                        onExited={onOverlayExited}
                        ptm={ptm}
                        cx={cx}
                        sx={sx}
                    />
                </div>
                {hasTooltip && <Tooltip target={elementRef} content={props.tooltip} {...props.tooltipOptions} pt={ptm('tooltip')} />}
            </>
        );
    })
);

Dropdown.displayName = 'Dropdown';
