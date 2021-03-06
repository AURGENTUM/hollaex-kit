import React from 'react';
import { reduxForm } from 'redux-form';
import classnames from 'classnames';

import { ICONS } from '../../config/constants';
import renderFields from '../../components/Form/factoryFields';

class SearchBox extends React.Component {
	render() {
		const {
			handleSearch,
			placeHolder,
			className = '',
			outlineClassName = '',
			name
		} = this.props;
		const searchField = {
			search: {
				name: name,
				type: 'text',
				options: { icon: ICONS.SEARCH, label: 'search' },
				className: classnames('search-field', className),
				hideCheck: true,
				outlineClassName: outlineClassName
					? outlineClassName
					: 'app-bar-search-field-outline',
				placeholder: placeHolder,
				onChange: handleSearch
			}
		};

		return renderFields(searchField);
	}
}

export default reduxForm({
	form: 'SearchForm'
})(SearchBox);
